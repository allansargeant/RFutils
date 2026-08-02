#!/usr/bin/env python3
"""Capture the app's tabs for the README and the user guide.

Point it at a running dev server with mock devices behind it:

    npm run dev:demo
    python3 scripts/screenshots.py                      # all tabs
    python3 scripts/screenshots.py monitor              # just these
    URL=http://localhost:5273 python3 scripts/screenshots.py

`dev:demo` matters rather than `dev` or `dev:verify` — it sets
RFUTILS_MOCK_DEVICES=1, so Monitor and Deployment have receivers to show.
`dev:verify` sets RFUTILS_DISABLE_MONITOR=1 and cannot photograph Monitor at
all.

Headless Chrome over the DevTools protocol rather than an OS screen capture,
and rather than Chrome's own `--screenshot` flag. Both of the simpler options
fail the same way here: `--virtual-time-budget` waits for the page to go idle,
which never happens while Monitor holds a live poll, and `--timeout` shoots
after a fixed delay and races the first device list — losing that race produces
a perfectly valid-looking picture of an empty tab.

So: navigate, switch tab, poll the DOM until the tab has actually rendered
content, and only then capture. A tab that never becomes ready is reported as a
failure rather than quietly saved. Same approach as caspar-av's equivalent
script, which is where the WebSocket client below came from.
"""
import base64
import http.client
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import shutil
import urllib.request

# CSS pixels; the existing shots in docs/screenshots are 2x these, so keep SCALE
# at 2 or a new capture will not sit next to the old ones.
WIDTH, HEIGHT, SCALE = 1200, 860, 2

CHROME = os.environ.get(
    "CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

# Per tab: the label to click, and a predicate that is true once the tab has
# rendered something worth photographing. "The tab is mounted" is not enough —
# Monitor mounts instantly and fills in as devices are discovered.
TABS = {
    "monitor": (
        "Monitor",
        "document.querySelectorAll('.device, .monitor__device, [class*=device]').length >= 2",
    ),
    "coordination": ("Coordination", "!!document.querySelector('button, input')"),
    "allocation": ("Allocation", "!!document.querySelector('button, input')"),
    "inventory": ("Inventory", "!!document.querySelector('button, input')"),
    "deployment": ("Deployment", "!!document.querySelector('button, select')"),
    "convert": ("Convert", "!!document.querySelector('input, button')"),
}


class WS:
    """The smallest WebSocket client that can carry CDP.

    Written out rather than pulled in: no WebSocket library is installed here,
    and this needs exactly two things — send a masked text frame, and read a
    frame that may be large (a screenshot is a megabyte of base64) or
    fragmented.
    """

    def __init__(self, url: str):
        _, rest = url.split("://", 1)
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n".encode()
        )
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        if b"101" not in buf.split(b"\r\n", 1)[0]:
            raise RuntimeError(f"websocket upgrade refused: {buf[:120]!r}")
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("websocket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text: str) -> None:
        payload = text.encode()
        header = bytearray([0x81])  # FIN + text
        mask = os.urandom(4)
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 1 << 16:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        header += mask
        self.sock.sendall(
            bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        )

    def recv(self) -> str:
        out = b""
        while True:
            b0, b1 = self._read(2)
            fin, length = b0 & 0x80, b1 & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._read(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._read(8))[0]
            if b1 & 0x80:  # server frames should never be masked
                self._read(4)
            out += self._read(length)
            if fin:
                return out.decode("utf-8", "replace")

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


class Chrome:
    def __init__(self):
        self.profile = tempfile.mkdtemp(prefix="rfutils-shot-")
        self.port = free_port()
        self.proc = subprocess.Popen(
            [
                CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
                "--no-default-browser-check", "--hide-scrollbars",
                f"--user-data-dir={self.profile}",
                f"--remote-debugging-port={self.port}",
                f"--window-size={WIDTH},{HEIGHT}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.ws = WS(self._target())
        self.msg_id = 0
        self.call("Page.enable")
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": WIDTH, "height": HEIGHT, "deviceScaleFactor": SCALE,
             "mobile": False},
        )

    def _target(self) -> str:
        deadline = time.time() + 30
        while time.time() < deadline:
            try:
                conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
                conn.request("GET", "/json/list")
                for t in json.loads(conn.getresponse().read()):
                    if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                        return t["webSocketDebuggerUrl"]
            except Exception:
                pass
            time.sleep(0.3)
        raise RuntimeError("Chrome never exposed a debuggable page")

    def call(self, method: str, params=None):
        self.msg_id += 1
        want = self.msg_id
        self.ws.send(json.dumps({"id": want, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == want:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def evaluate(self, expression: str):
        r = self.call("Runtime.evaluate", {"expression": expression, "returnByValue": True})
        return r.get("result", {}).get("value")

    def wait_for(self, expr: str, timeout: float) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if self.evaluate(expr) is True:
                    return True
            except RuntimeError:
                pass  # navigation in flight; the context is briefly gone
            time.sleep(0.25)
        return False

    def shoot(self, url: str, label: str, ready: str, path: str,
              timeout: float = 45.0) -> bool:
        self.call("Page.navigate", {"url": url})
        if not self.wait_for("!!document.querySelector('nav.tabs button')", 20):
            return False
        # Tabs are React state with no URL of their own, so the tab is chosen by
        # clicking its button rather than by navigating to it.
        clicked = self.evaluate(
            "(() => { const b = [...document.querySelectorAll('nav.tabs button')]"
            f".find(e => e.textContent.trim().startsWith({json.dumps(label)}));"
            " if (!b) return false; b.click(); return true; })()"
        )
        if clicked is not True:
            print(f"    ! no tab button labelled {label!r}", file=sys.stderr)
            return False
        if not self.wait_for(ready, timeout):
            return False
        # The vendored support footer is injected into every page and is site
        # chrome, not app UI. captureBeyondViewport takes the whole document, so
        # without this a docs screenshot ends on a row of donate buttons that no
        # other shot in docs/screenshots has.
        self.evaluate(
            "(() => { const f = document.querySelector('footer.sw-support');"
            " if (f) f.style.display = 'none'; return true; })()"
        )
        # A beat for the final paint — readiness is about state, not pixels.
        time.sleep(0.8)
        data = self.call("Page.captureScreenshot", {"format": "png",
                                                    "captureBeyondViewport": True})["data"]
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        return True

    def close(self) -> None:
        self.ws.close()
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        shutil.rmtree(self.profile, ignore_errors=True)


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main(argv: list[str]) -> int:
    url = os.environ.get("URL", "http://localhost:5173")
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(repo, "docs", "screenshots")
    os.makedirs(out, exist_ok=True)

    want = [a for a in argv if a in TABS] or list(TABS)
    unknown = [a for a in argv if a not in TABS]
    for u in unknown:
        print(f"! unknown tab {u!r}; known: {', '.join(TABS)}", file=sys.stderr)

    try:
        urllib.request.urlopen(url, timeout=5).read(1)
    except Exception as e:
        print(f"no dev server at {url}: {e}\nrun `npm run dev:demo` first",
              file=sys.stderr)
        return 1
    if not os.path.exists(CHROME):
        print(f"Chrome not found at: {CHROME}", file=sys.stderr)
        return 1

    print(f"==> capturing from {url}")
    chrome, failed = Chrome(), 0
    try:
        for name in want:
            label, ready = TABS[name]
            path = os.path.join(out, f"{name}.png")
            if chrome.shoot(url, label, ready, path):
                print(f"    {name:<14} {os.path.getsize(path) // 1024}K")
            else:
                print(f"    {name:<14} FAILED — tab never rendered content")
                failed += 1
    finally:
        chrome.close()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
