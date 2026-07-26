# Product plugins

Device support in RFutils is **one plugin per product** (e.g. *Shure ULX-D*, *Shure Axient Digital*,
*Sennheiser EW-DX* are separate plugins). A plugin bundles a product's **coordination**
characteristics and, optionally, how to **control** it. Plugins are plain **JSON data** — no code —
so you can add new products or correct the built-ins yourself.

## Adding / overriding a plugin

Drop a `.json` file into `~/.rfutils/plugins/` (or `$RFUTILS_CONFIG_DIR/plugins/`) — one file per
product is the tidy convention, but a file may also contain an array. A plugin whose `id` matches a
built-in **overrides** it (handy for fixing a command template or tuning number). Restart the server
to pick up changes. Your plugins flow into the equipment picker (Coordination/Inventory) and the
programming layer automatically.

Built-ins + your plugins are listed at `GET /api/plugins`.

## Schema

```jsonc
{
  "id": "shure-ulxd",                 // unique; same id overrides a built-in
  "manufacturer": "Shure",
  "model": "ULX-D",
  "category": "mic",                  // "mic" | "iem" | "other"

  // coordination
  "tuningStepKhz": 25,                // tuning raster
  "occupiedBandwidthKhz": 200,        // occupied RF bandwidth per carrier
  "recommendedSpacingMhz": 0.35,      // recommended carrier spacing
  "defaultBandPresetId": "uk-uhf-core", // prefills the ranges in the form (optional)
  "bands": [{ "startMhz": 470, "endMhz": 608 }], // optional product-specific ranges

  // control (optional — omit for coordinate + export only)
  "control": {
    "transport": "shure-command-strings",       // engine that talks to it
    "capabilities": { "discover": true, "monitor": true, "program": true },
    "matchModel": "ULXD?",                        // regex to claim a discovered device
    "programTemplate": "< SET {ch} FREQUENCY {khz6} >"
  },

  "verified": false,                  // set true once you've checked it against the datasheet
  "notes": "…"
}
```

### Transports

| `transport` | What it does |
|---|---|
| `shure-command-strings` | Shure's ASCII protocol (TCP 2202) — discover, monitor, and **program** via `programTemplate`. |
| `sennheiser-ssc` | Sennheiser SSC — discover/monitor (skeleton). |
| `lectrosonics-net` | Lectrosonics Ethernet control (DSQD/Duet) — discover/monitor/**program**. Adapter wired; wire format is an unverified placeholder (see server `lectrosonicsProtocol.ts`) — dry-run and verify. Opt-in scan via `RFUTILS_LECTRO_SCAN=1`; port via `RFUTILS_LECTRO_PORT`. |
| `none` / omit `control` | No live control — coordination + file export only. |

### Program-command placeholders

`programTemplate` is filled per channel: `{ch}` channel number · `{khz}` integer kHz · `{khz6}`
6-digit kHz · `{mhz3}` MHz to 3 dp. Example: `"< SET {ch} FREQUENCY {khz6} >"` →
`< SET 1 FREQUENCY 470125 >`.

## Notes & safety

- Plugins are **declarative JSON** — RFutils never executes plugin code, so a plugin can't do
  anything beyond describing a product and a command template. Brand-new *protocols* (not just a new
  command template on an existing transport) still need a transport engine in the server.
- Built-in command templates and tuning numbers are **best-effort / unverified** — check against the
  product's Command Strings PDF / datasheet, and set `"verified": true` in your own copy once you
  have.
- Regional tuning ranges are **band presets**, not part of a product plugin (a product ships in many
  band variants). Add your own via `$RFUTILS_CONFIG_DIR/profiles.json` → `{ "bandPresets": [...] }`.

See [BRANDS.md](BRANDS.md) for which brands have live control today, and
[`packages/shared/src/plugins.ts`](../packages/shared/src/plugins.ts) for the built-in catalog.
