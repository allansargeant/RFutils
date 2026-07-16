// av-launcher panel controller.
//
// Talks to the Rust backend via Tauri's global `invoke`. When opened in a plain
// browser (no Tauri), it falls back to mock data so the panel still renders —
// handy for previewing the design.

const hasTauri = !!(window.__TAURI__ && window.__TAURI__.core);
const invoke = hasTauri ? window.__TAURI__.core.invoke : mockInvoke;

const el = (id) => document.getElementById(id);
const ui = {
  appName: el("app-name"),
  appSub: el("app-sub"),
  band: el("status-band"),
  word: el("status-word"),
  url: el("status-url"),
  iface: el("iface"),
  port: el("port"),
  toggle: el("toggle"),
  launch: el("launch"),
  hide: el("hide"),
  quit: el("quit"),
  gear: el("gear"),
  dot: el("logo-dot"),
  msg: el("msg"),
};

let running = false;
let pollTimer = null;

function flash(text, isError = false) {
  ui.msg.textContent = text || "";
  ui.msg.classList.toggle("error", isError);
}

function renderStatus(status) {
  running = status.running;
  ui.word.textContent = status.running ? "Running" : "Stopped";
  ui.url.textContent = status.url || "—";
  ui.url.href = status.url || "#";
  ui.band.classList.toggle("running", status.running);
  ui.dot.setAttribute("fill", status.running ? "#37d05a" : "#e11d1d");

  ui.toggle.textContent = status.running ? "Stop" : "Start";
  ui.toggle.classList.toggle("is-running", status.running);
  // Interface/port are locked while the server is running.
  ui.iface.disabled = status.running;
  ui.port.disabled = status.running;
  ui.launch.disabled = !status.running;

  if (status.message && status.message !== "Running" && status.message !== "Stopped") {
    flash(status.message);
  } else {
    flash("");
  }
}

async function refreshStatus() {
  try {
    renderStatus(await invoke("get_status"));
  } catch (e) {
    flash(String(e), true);
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(refreshStatus, 2000);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function persist() {
  const port = parseInt(ui.port.value, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    flash("Port must be 1–65535", true);
    return;
  }
  try {
    await invoke("save_settings", { port, interface: ui.iface.value });
    await refreshStatus(); // updates the URL preview
  } catch (e) {
    flash(String(e), true);
  }
}

async function init() {
  try {
    const info = await invoke("get_app_info");
    ui.appName.textContent = info.name;
    ui.appSub.textContent = "AV Launcher";
    document.title = `${info.name} — AV Launcher`;

    const ifaces = await invoke("list_interfaces");
    const settings = await invoke("get_settings");
    ui.iface.innerHTML = "";
    for (const i of ifaces) {
      const opt = document.createElement("option");
      opt.value = i.name;
      opt.textContent = i.label;
      if (i.name === settings.interface) opt.selected = true;
      ui.iface.appendChild(opt);
    }
    ui.port.value = settings.port;

    await refreshStatus();
    startPolling();
  } catch (e) {
    flash(String(e), true);
  }
}

// --- Wiring ---
ui.iface.addEventListener("change", persist);
ui.port.addEventListener("change", persist);

ui.toggle.addEventListener("click", async () => {
  ui.toggle.disabled = true;
  try {
    renderStatus(await invoke(running ? "stop_server" : "start_server"));
  } catch (e) {
    flash(String(e), true);
  } finally {
    ui.toggle.disabled = false;
  }
});

ui.launch.addEventListener("click", async () => {
  try {
    await invoke("open_gui");
  } catch (e) {
    flash(String(e), true);
  }
});

ui.hide.addEventListener("click", () => invoke("hide_window").catch(() => {}));
ui.quit.addEventListener("click", () => invoke("quit_app").catch(() => {}));
ui.gear.addEventListener("click", () =>
  flash("Config: ~/Library/Application Support/com.allansargeant.av-launcher")
);

window.addEventListener("DOMContentLoaded", init);

// ---------- Mock backend (browser preview + screenshots only) ----------
// Query params let a headless render pick the app/port/state, e.g.
//   index.html?app=flock&port=8080&state=running&host=10.147.17.93
function mockInvoke(cmd, args = {}) {
  const q = new URLSearchParams(location.search);
  const host = q.get("host") || "10.147.17.93";
  const s =
    mockInvoke.state ||
    (mockInvoke.state = {
      running: q.get("state") === "running",
      port: Number(q.get("port")) || 8080,
      iface: q.get("iface") || "en0",
    });
  const url = () => {
    const h = s.iface === "lo0" ? "127.0.0.1" : host;
    return `http://${h}:${s.port}/`;
  };
  const status = () => ({
    running: s.running,
    url: url(),
    host,
    port: s.port,
    message: s.running ? "Running" : "Stopped",
  });
  switch (cmd) {
    case "get_app_info":
      return Promise.resolve({
        name: q.get("app") || "SRT Router",
        default_port: s.port,
        url_template: "http://{host}:{port}/",
      });
    case "list_interfaces":
      return Promise.resolve([
        { name: "all", ip: "0.0.0.0", label: "All interfaces (0.0.0.0)", loopback: false },
        { name: "en0", ip: "10.147.17.93", label: "en0: 10.147.17.93", loopback: false },
        { name: "lo0", ip: "127.0.0.1", label: "lo0: 127.0.0.1", loopback: true },
      ]);
    case "get_settings":
      return Promise.resolve({ port: s.port, interface: s.iface });
    case "save_settings":
      s.port = args.port;
      s.iface = args.interface;
      return Promise.resolve();
    case "get_status":
      return Promise.resolve(status());
    case "start_server":
      s.running = true;
      return Promise.resolve(status());
    case "stop_server":
      s.running = false;
      return Promise.resolve(status());
    default:
      return Promise.resolve();
  }
}
