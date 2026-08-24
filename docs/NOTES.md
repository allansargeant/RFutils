# Notes

Working notes for this repo: status, decisions, and the traps that have actually bitten.
Migrated out of Claude Code's memory on 2026-08-24, so they are written in the first
person and dated by when each thing was learned — that date is usually the useful part.

Cross-cutting notes that are not specific to this repo live in
[fleet-notes](https://github.com/stoatworks-labs/fleet-notes).

*RFutils — unified browser-based RF coordination + wireless-mic suite merging three prior tools, at ~/Projects/RFutils*

RFutils (originally scaffolded as "RFWizard", renamed 2026-07-15) unifies three of the user's
separate tools into one browser-based app at `~/Projects/RFutils`, extensible into frequency
coordination/allocation/deployment services.

- **Merges:** wsm-wwb-bridge (WWB/WSM/CSV coordination file exchange), pmse-to-wwb (Ofcom PMSE
  licence PDF → WWB), and MicWizard (networked Shure/Sennheiser/AES67 receiver monitoring).
- **Stack (user chose):** single Node/TypeScript stack, all three built at once. npm workspaces
  monorepo — `packages/shared` (@rfutils/shared: model + wire types), `packages/server`
  (@rfutils/server: Express + ws — file conversion + device discovery), `packages/web`
  (@rfutils/web: React/Vite tabbed UI). Env prefix `RFUTILS_` (SERVER_PORT default 8420,
  DISABLE_MONITOR, CONFIG_DIR default ~/.rfutils). Dev: `npm run dev` (server :8420, web :5273).
- Python parsers (wsm-wwb-bridge) ported to TS and **verified byte-for-byte against the originals**
  on real vendor exports; `.shw` generator produces byte-identical output. MicWizard networking
  moved from Electron main process into the server.
- UI tabs: Convert · Monitor · (roadmap) Coordination/Allocation/Deployment.
- Built & verified in browser 2026-07-15. **Public GitHub repo: allansargeant/RFutils** (pushed
  2026-07-15, branch `main`). README has 3 screenshots (docs/screenshots/); `RFUTILS_MOCK_DEVICES=1`
  / `npm run dev:demo` seeds simulated receivers for demos.
- **Audio cueing restored** (was dropped in the web port): browser can't join AES67 multicast, so
  the server relays the one cued channel as PCM16 mono over a dedicated binary WebSocket `/ws/audio`,
  played via an AudioWorklet ring buffer (public/pcm-player-worklet.js). AES67 channels only;
  ref-counted per-channel streaming; mock-mode synthetic tone makes it testable without hardware
  (verified end-to-end, analyser reads the expected −15 dBFS). Opus/WebRTC noted as the future
  lower-latency upgrade. Both WS endpoints use `noServer` + one upgrade router (two `{server,path}`
  WebSocketServers 400 each other — gotcha).
- **Capture mode (recommended audio path, added later):** instead of decoding AES67 ourselves, the
  user supplies DVS/a Dante interface; server captures one local audio channel (the "cue bus") via
  ffmpeg subprocess (`captureSource.ts`, s16le mono), Companion routes the clicked mic to that bus
  (`RFUTILS_CUE_BUS_DEVICE/_CHANNEL`), and it streams via the same /ws/audio→AudioWorklet path.
  Enabled by `RFUTILS_CAPTURE_DEVICE`/`_CMD`; then ALL channels are cueable (not just AES67).
  Real-time pacer in CaptureSource throttles faster-than-real-time sources via stdout pause/resume
  (a sox generator flooded the relay otherwise). Verified with `npm run dev:capture-demo` (sox tone,
  no ffmpeg/DVS needed) — analyser reads −13.5 dBFS. Auto-route source names must match Dante
  Controller labels. **ffmpeg installed** (8.1.2, /opt/homebrew/bin/ffmpeg, confirmed 2026-07-16);
  the default ffmpeg command builder + real-time pacer verified with a real ffmpeg subprocess
  (lavfi sine → ~real-time PCM). macOS avfoundation audio device spec is `:<audioIndex>` (list with
  `ffmpeg -f avfoundation -list_devices true -i ""`); DVS appears there as "Dante Virtual Soundcard"
  when running (this machine had Pro Tools/L-ISA/NDI audio bridges but DVS wasn't active).

**PMSE PDF parser: VALIDATED** against a real Ofcom PMSE licence (user supplied
`~/Downloads/Schedule (84).pdf`, 116-assignment NoV, ST16 landscape template) — all 116
assignments, frequencies, sites, periods, fees + header metadata parse correctly. pdfjs-dist has no
table detector, so it buckets positioned text into the fixed ST16 column geometry
(`COL_LEFT_EDGES_842`, scaled by page width) and merges the ~3 physical lines per row. A materially
different Ofcom template revision would need re-calibration. **The licence PDF is real and must NOT
go in the (public) repo** — kept in ~/Downloads only; repo `.gitignore` blocks `*.pdf`. Monitor
vendor adapters remain untested against real hardware (inherited from MicWizard). See
**disclaimer scope** (working-practice note, kept in Claude memory).

**Per-product plugin system (2026-07-26):** device support is now one declarative JSON plugin **per
product** (not per brand) — `packages/shared/src/plugins.ts` `BUILTIN_PLUGINS` (22: Shure ULX-D/
Axient/QLX-D/SLX-D/PSM1000/GLX-D each separate, Sennheiser, Lectrosonics, Wisycom, Sound Devices,
Audio Ltd, Sony, MiPro, DPA N-Series, Deity, Audio-Technica). `EQUIPMENT_PROFILES` derived from
plugins. Users add/override via `~/.rfutils/plugins/*.json` (matching `id` overrides a built-in;
server `plugins/registry.ts`). `GET /api/plugins`; `/api/program` is transport-dispatched +
template-driven (`programTemplate` with `{ch}/{khz6}/{khz}/{mhz3}`), auto-matches a discovered
device's model via `control.matchModel`. Docs: `docs/PLUGINS.md`. All values `verified:false`.
**Lectrosonics adapter added** (`lectrosonics-net` transport: discovery/monitor/program) — but its
**wire format is an UNVERIFIED PLACEHOLDER** isolated in server
`monitor/discovery/lectrosonicsProtocol.ts` (port/terminator/frames guessed; runtime-overridable via
`RFUTILS_LECTRO_PORT`/`_TERM`/`_SCAN`). Discovery scan opt-in (`RFUTILS_LECTRO_SCAN=1`); programming
dry-run by default. Same Lectrosonics placeholder was mirrored into [dante babelbox](https://github.com/stoatworks-labs/Dante-BabelBox/blob/main/docs/NOTES.md) (`Dante-BabelBox`) as a
mic-telemetry adapter. Checks: `npm run typecheck`/`lint`/`test` (44 tests).

**2026-08-06 — RFutils now has its own capture guide**, `docs/capture-guide.md`, linked
from the README and BRANDS.md. Dante-BabelBox's three guides are written entirely around a
desk and a stagebox, and pointing here at those would leave the reader translating.

The thing the RFutils guide gets to say that those cannot: for most of these brands the
conversation is between the receiver and vendor software running on the reader's **own
laptop**, so there is nothing to bridge or mirror — Wireshark on that laptop already sees
the packets. That is method A and it is the row almost everyone is in. Method B is a
mirrored port, for a receiver mounted on a console (it unicasts to that console, so an
ordinary switch port sees nothing) — see [unifi port mirroring](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_unifi_port_mirroring.md). Method C
defers to the Dante-BabelBox guides rather than restating them.

The guide leads on **Lectrosonics**, because that adapter is written end to end
(discovery, telemetry, programming, dry-run) and blocked on one file's worth of wire
format in `lectrosonicsProtocol.ts` — the highest-value capture on the list by some way.
It also tells people to filter by `ip.addr` and export before sending, since a capture
holds everything that reached the interface.

Covered by the shared "Send us a capture" video with Dante-BabelBox — see
[project videos](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/project_project_videos.md).
