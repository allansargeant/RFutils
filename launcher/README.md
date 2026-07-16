# RFutils Launcher

A Bitfocus Companion–style **tray launcher** for RFutils: pick a network
interface + port, Start/Stop the server, open the web UI, and run it from the
macOS menu bar. Built with [Tauri v2](https://tauri.app).

![panel](docs/panel.png)

Download the latest `.dmg` from the repo's
[Releases](https://github.com/allansargeant/RFutils/releases).

> **Requires Node + a local RFutils build.** Unlike the fleet's Rust launchers,
> RFutils is a Node app, so this launcher is **not** a fully self-contained
> binary — it spawns the system `node` against your local RFutils build and
> injects host/port via environment variables. Before using it:
>
> 1. Install [Node](https://nodejs.org) (v18+).
> 2. Build RFutils: `cd ~/Projects/RFutils && npm install && npm run build`.
>
> If RFutils lives somewhere other than `~/Projects/RFutils`, edit the two
> absolute paths in `src-tauri/launcher.toml` (and rebuild).

> **Unsigned build.** On first launch macOS Gatekeeper will block it —
> right-click the app → **Open** → **Open**, once.

## What it does

- **GUI Interface** — every bindable IPv4 interface, plus "All interfaces (0.0.0.0)".
- **Port** — persisted between runs (RFutils default 8420).
- **Start / Stop** — supervises the `node dist/index.js` child process.
- **Launch GUI** — opens `http://<host>:<port>/` in your browser.
- **Hide** to the tray; **Quit** stops the server and exits.

Host:port is injected as `RFUTILS_SERVER_PORT` / `RFUTILS_HOST` environment
variables — no config file is touched.

## Building from source

```bash
cd launcher
./scripts/prepare.sh          # builds the local RFutils (npm run build)
npm install
npm run tauri build           # -> src-tauri/target/release/bundle/{macos,dmg}/
```

Run in dev:

```bash
npm run tauri dev
```

## How it relates to av-launcher

This is a self-contained copy of the reusable
[av-launcher](https://github.com/allansargeant/av-launcher) shell configured for
RFutils' env-based startup. The Rust/JS shell is identical across the fleet;
only `src-tauri/launcher.toml` and the icon differ.
