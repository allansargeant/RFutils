# Brand support

Device support is organised as **one [product plugin](PLUGINS.md) per product** (Shure ULX-D,
Axient Digital, QLX-D … are separate plugins), and users can add or override plugins with plain
JSON. RFutils supports gear at three levels:

1. **Coordinate + export** — works for *any* UHF wireless brand. Add it to the inventory (or pick an
   equipment profile) and it feeds coordination; export the result to WWB/WSM/CSV to load into the
   vendor's own software. Available for everything below.
2. **Audio cue to headphones** — for anything with a **Dante/AES67** output, via capture mode (a
   DVS/Dante interface routed with Companion). This is generic — no per-brand adapter needed.
3. **Live discover / monitor / program** — needs a per-brand network-control adapter. Wired today:
   **Shure** (Command Strings, TCP 2202), **Sennheiser** (SSC — skeleton), and **Lectrosonics**
   (Ethernet control, DSQD/Duet — adapter wired but wire format is an unverified placeholder; see
   below).

| Brand | Systems | Control interface | Live control in RFutils? | Dante audio cue? |
|---|---|---|---|---|
| **Shure** | ULX-D, QLX-D, Axient Digital, SLX-D, PSM 1000 | Command Strings (TCP 2202, documented) | ✅ discover/monitor/**program** | via Dante models |
| **Sennheiser** | EW-DX, EW-D, Digital 6000/9000, G4, 2000 | SSC (JSON over TCP) | ⚠️ monitor (skeleton, untested) | via Dante models |
| **Lectrosonics** | DSQD, D Squared, DCR822 | **Ethernet control port — Wireless Designer *or third-party*** | ⚠️ discover/monitor/**program** — adapter wired, wire format unverified | via Dante |
| **Wisycom** | MCR54, MTP | Ethernet "Wisycom Remote Protocol" (Wisycom Manager) | ❌ proprietary; reverse-engineerable | via Dante models |
| **Sound Devices** | A20-Nexus / Astral | IP web-app API + NexLink + Dante | ❌ proprietary web API; reverse-engineerable | ✅ Dante |
| **Audio Ltd** | A10 (now Sound Devices) | limited | ❌ | — |
| **Sony** | DWX (DWR-R03D) | Wireless Studio (PC) + Dante | ❌ proprietary; reverse-engineerable | ✅ Dante |
| **MiPro** | ACT series | RCS2.Net over proprietary ACT-BUS | ❌ proprietary | via Dante (ACT-7x) |
| **Deity** | Theos | Sidus Audio **phone app / Bluetooth** | ❌ not an open network protocol | — |
| **Audio-Technica** | 5000 series | proprietary | ❌ | — |

**DPA** is intentionally absent: DPA makes microphone **capsules/lavaliers** (which clip onto other
brands' transmitters), not RF wireless systems, so there's nothing to coordinate, monitor, or
program — pick the transmitter's brand instead.

## Adding live control for another brand

Two paths, in order of tractability:

- **Lectrosonics DSQD** — adapter is **wired** (discover/monitor/program), but its wire format is an
  unverified placeholder isolated in
  [`lectrosonicsProtocol.ts`](../packages/server/src/monitor/discovery/lectrosonicsProtocol.ts).
  Correct the port + framing there from a packet capture / the official IP-control spec, set
  `RFUTILS_LECTRO_SCAN=1` to enable discovery and `verified: true` on the plugin once confirmed.
- **Wisycom / Sony / Sound Devices / MiPro** — have real network protocols but proprietary and
  undocumented; an adapter means packet-capturing the vendor software (the same approach used to
  build the Shure/Sennheiser adapters) — feasible but more effort and hardware-dependent.
- **Deity / analog FM / IR-sync gear** — no open network control; coordination + export only.

## A second Shure control path: ACN

A QLX-D **mounted on a Yamaha console** is not using Command Strings at all — the console
drives it over ANSI E1.17 (ACN), on entirely different ports, with its own discovery
mechanism and property map. RFutils does not implement this and doesn't need to, but
[`SHURE-ACN.md`](SHURE-ACN.md) records what was observed on the wire in case that changes,
and because it explains the extra multicast traffic if RFutils shares a network with a
console-mounted receiver.

Every entry's control situation is also recorded in the equipment profile `notes`
([`packages/shared/src/profiles.ts`](../packages/shared/src/profiles.ts)), and the catalog is
user-extensible via `~/.rfutils/profiles.json`.
