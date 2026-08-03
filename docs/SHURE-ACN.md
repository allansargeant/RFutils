# Shure QLX-D over ACN — the console-mount control path

> ## 🔬 Built from real hardware
>
> Every property in the map below was read off a **real Shure QLXD4** on a real
> network — including a capture of the receiver power-cycling and re-joining
> (which is where the session handshake came from), a run with a transmitter
> switched on, and a battery swap performed specifically to pin the battery
> scale against the receiver's own front-panel display.
>
> Findings marked **Confirmed** were verified against ground truth, not
> inferred from packet shape. Where something did not hold up — see
> `0x02000812` — it has been demoted rather than quietly kept.
>
> **This is documentation, not implemented code.** RFutils does not speak ACN
> and does not need to; the supported Shure path remains Command Strings. What
> this gives you is a verified starting point if that ever changes.

*Reverse-engineered from packet captures of a real Shure QLXD4 receiver mounted
on a real Yamaha QL1 console, including a live capture of the receiver booting
and re-joining, and a run with a transmitter switched on.*

RFutils talks to Shure receivers over **Command Strings** — plaintext ASCII on
TCP 2202 ([BRANDS.md](BRANDS.md)). That is Shure's documented interface and
nothing here changes it. But a QLX-D mounted on a Yamaha console uses a
**completely different protocol on a different transport**, and no capture here
contains a single byte of port-2202 traffic.

This document describes that second path.

---

## 1. What it actually is

**ANSI E1.17 — Architecture for Control Networks (ACN)**. The same standard
family as sACN/E1.31, but the full control stack rather than the streaming
subset:

- **SLPv2** for discovery
- **SDT** (Session Data Transport) for sessions
- **DMP** (Device Management Protocol) for properties

The decode below came from a hand-written parser verified byte-for-byte against
Wireshark's own `acn` dissector, which decodes these packets natively:

```bash
tshark -r capture.pcapng -d udp.port==57383,acn -d udp.port==5568,acn -V
```

Where the two disagreed on vector *names*, Wireshark won — its numbering is
authoritative here (`Ack` is 14, not 1; `Subscribe Accept` is 12).

## 2. Capture provenance

| | |
|---|---|
| Receiver | Shure QLXD4 — MAC `00:0e:dd:47:e0:d7`, `169.254.216.224`, named `House 1` / channel `Head 6`, on 606.700 MHz |
| Console | Yamaha QL1 — `169.254.191.250` (console NIC, not the Dante NIC) |
| `qlxd mount.pcapng` | 181 s, receiver mounted and idle |
| `qlx d.pcapng` | 40 s, AF output level driven from the console |
| reboot capture | 160 s spanning a receiver power-cycle — **contains the full session setup** |
| transmitter capture | 356 s, transmitter switched on at t≈200 s |

Both devices are on IPv4 link-local, with no DHCP server. There is no Dante
audio between them — the QLX-D is on the network purely as a control device.

## 3. Discovery — SLPv2 on a non-standard group

Every ~2 s each device multicasts an **SLPv2 AttrRply** (function 7) to
**`239.255.254.253:8427`**. Both address and port are one digit off the
registered SLP values (`239.255.255.253:427`), so a standard SLP library pointed
at the standard group finds nothing.

The receiver's advertisement in full:

```
(cid=DD47E0D7-0000-11DD-A000-000EDDCCCCCC),
(acn-fctn=QLXD4),
(acn-uacn=QLXD4),
(acn-services=esta.dmp),
(csl-esta.dmp=esta.sdt/169.254.216.224:57383;
              esta.dmp/cd:CCEAC054-E139-11DF-84BA-0015C5F3F612),
(device-description=$:tftp://169.254.216.224/$.ddl)
```

- `acn-fctn` — **fixed model name**, `QLXD4`. The console advertises
  `Yamaha Console`. Free model identification with no session required.
- `acn-uacn` — user-assigned name; defaults to the model name.
- `cid` — component ID. The first group's low bytes are the device MAC
  (`DD47E0D7` ← `…47:e0:d7`), so CID and MAC are derivable from each other.
- `csl-esta.dmp` — where to open a session, plus the **DCID** (device class ID).

Passive listening on this group enumerates model, name and address for every
ACN-speaking Shure receiver present, with no connection made.

### The DDL is advertised but not served — verified

`device-description` points at a TFTP URL for the device's DDL (ACN's
machine-readable device description). **It does not work.** Requesting
`$.ddl`, the DCID in upper and lower case, the bare DCID, and `QLXD4.ddl` from
an IPv4 link-local source the receiver can reply to produced **no response of
any kind** — not even a TFTP `ERROR` packet, which a running server sends for a
missing file. There is no TFTP server on the receiver. Don't plan around it.

## 4. Transport — SDT sessions

Sessions run on **UDP 57383** (both source and destination port). Each party
owns a *channel*:

| Party | Channel | Sends to |
|---|---|---|
| Console | `0x794b` | `239.195.234.61:5568` (multicast, in the E1.17 SDT range) |
| Receiver | `0xf171` | console unicast |

Steady state uses only **Unreliable Wrapper** (2) carrying payload and **Ack**
(14) coming back. Session setup uses the reliable path.

### Session establishment

Captured during a receiver power-cycle. The sequence, ~80 ms end to end:

```
console → receiver   JOIN            (console offers channel 0x794b)
receiver → console   JOIN_ACCEPT
receiver → console   JOIN            (receiver offers channel 0xf171)
console → receiver   JOIN_ACCEPT
console → receiver   CONNECT         (protocol 0x00000002 = DMP)
receiver → console   CONNECT_ACCEPT
console → receiver   SUBSCRIBE  × 6
receiver → console   SUBSCRIBE_ACCEPT × 6
console → receiver   GET_PROPERTY × 9
receiver → console   GET_PROPERTY_REPLY × 9
console → receiver   SUBSCRIBE  × 6      (second batch)
receiver → console   SUBSCRIBE_ACCEPT × 6
```

**Both parties join each other** — this is a symmetric pair of channels, not one
client connecting to one server. Teardown on power-off is
`LEAVE` / `LEAVING` / `DISCONNECT` / `DISCONNECTING`.

After setup the receiver pushes unsolicited **`EVENT`** messages at **~8 Hz**
carrying whichever subscribed properties changed. The console never polls.

## 5. Property map

Twelve properties are subscribed, in two batches of six. All are 4-byte
absolute, non-virtual addresses.

| Address | Type | Meaning | Confidence |
|---|---|---|---|
| `0x01000000` | string | **Model name** — `QLXD4` | **Confirmed** |
| `0x01000012` | string | **Device name** — `House 1` | **Confirmed** |
| `0x02000001` | string | **Channel name** — `Head 6` | **Confirmed** |
| `0x02000102` | int8, dB | **AF output level** | **Confirmed** |
| `0x02000804` | uint32, kHz | **Frequency** — `606700` = 606.700 MHz | **Confirmed** |
| `0x02000114` | int32, dBm | **RF level** | **Confirmed** |
| `0x02000101` | uint8 | **RF meter segments, 0–5** | **Confirmed** |
| `0x02001100` | int8 | **Battery bars, 0–5**, `-1` = no recent data | **Confirmed** |
| `0x02000812` | int16 | Receiver-side level — units and meaning unresolved | Partial |
| `0x02000815` | uint8 | 0–2 indicator, tracks `0x02000812` | Partial |
| `0x0200110a` | int16 | `-1` throughout — never updated | Unknown |
| `0x02001126` | int8 | `-1` throughout — never updated | Unknown |
| `0x02000104` | uint8 | `0` throughout | Unknown |

Strings are **length-prefixed**: a `uint16` total length including the two
length bytes, then the characters, unterminated. `0009 "House 1"` = 7 chars + 2.

### `0x02000102` — AF output level

The only writable property observed. The console sends **`SET_PROPERTY`**; the
receiver echoes an **`EVENT`** with the same value **10–25 ms later**, and
answers `GET_PROPERTY` with `GET_PROPERTY_REPLY`.

Confirmed by 37 sets sweeping the console encoder: **−18 … +40**, signed 8-bit,
plain dB, no scaling. The sweep clamped hard at −18, matching the QLXD4's
documented minimum, so the range is almost certainly the receiver's full
**−18 … +42 dB**. A later mount read back `fd` (−3) — exactly where the previous
session's sweep had left it.

### `0x02000114` / `0x02000101` — RF

`0x02000114` reads a flat **−50 dBm with no carrier** (a floor, not a
measurement) and **−19 … −35 dBm** with a transmitter on. `0x02000101` is the
console's RF bar graph, **0 with no carrier, 1–5 with**, moving in lockstep.

### `0x02000812` / `0x02000815` — unresolved, and probably not audio

The first reading of these was "audio meter": with a carrier present
`0x02000812` swings roughly −50 … −102 and `0x02000815` moves 0–2 with it.

A later capture undermined that. With **no carrier at all** — RF pinned at the
−50 floor, 0 RF bars, no transmitter powered — `0x02000812` still drifts
continuously between about −65 and −55, and `0x02000815` still moves. A
receiver-side audio meter on a muted receiver should be static at the floor.

So whatever these measure exists independently of a transmitter. A noise-floor
or squelch measurement fits better than audio level, but that is speculation.
**Unresolved.** Do not present `0x02000812` as an audio level, and do not give
it a unit — no calibrated signal was ever injected.

### `0x02001100` — battery bars

**Confirmed against the receiver's own front-panel display**, by reading the
panel at known moments and comparing:

| Front panel | `0x02001100` |
|---|---|
| 2 bars, carrier solid | `2`, held across 10 consecutive samples |
| cells removed | `-1` |
| fresh cells fitted | `5` immediately on link |

int8, **0–5** matching the QLX-D's five-segment battery display, `-1` = no
recent data.

Two behaviours worth implementing around:

- **The first sample after link acquisition is a transient.** On acquiring a
  carrier the receiver emits one reading that does not match the panel (a `3`
  where the panel said 2), then settles within ~4 s. Discard the first reading
  after a link comes up.
- **`-1` means "no recent data", not "no carrier".** When the carrier drops the
  value *holds* its last reading; it only falls to `-1` after a longer dropout.

An earlier run made this look like it was sliding 3 → 2 → 1 over 30 s. That was
an artefact: the carrier was dropping repeatedly, so the acquisition transient
was being seen over and over and read as a downward trend.

### `0x0200110a` and `0x02001126` — battery run time, unconfirmed

Subscribed, but they emitted **not one event** across every capture, including a
full battery swap, holding `-1` throughout. Their `-1` sentinels match what
Shure's Command Strings return for `BATT_RUN_TIME` and `BATT_CHARGE` when
unavailable, and the transmitter under test ran alkaline cells — with no Shure
rechargeable there is no run-time estimate to report. Plausible but **not
confirmed**: it needs a run with an SB900-series pack fitted.

## 6. How this compares to Command Strings

Much better than the first pass suggested. **Confirmed against hardware:** model,
device name, channel name, frequency, RF level, RF bars, battery bars, and AF
gain — which covers most of what RFutils' Monitor tab shows.

The remaining gap is **audio level**, where Command Strings' `SAMPLE` gives a
figure and ACN's equivalent has not been identified. `0x02000812` was the
obvious candidate and does not hold up.

## 7. Open questions

1. **Find audio level.** Not `0x02000812` — see above. It may be one of the
   subscribed-but-silent addresses, or not exposed on this path at all.
2. **Confirm battery run time** with a Shure SB900-series rechargeable fitted,
   which should bring `0x0200110a` / `0x02001126` to life.
3. **Does a QLX-D serve 2202 and ACN simultaneously?** These captures can't say
   — Wireless Workbench was never running, so the absence of port-2202 traffic
   proves nothing either way.
4. **Do ULX-D and Axient Digital share the property map?** Both mount on Yamaha
   consoles the same way. If `0x0200xxxx` is common, one decoder covers the range.

## 8. Status

Nothing here is implemented **in RFutils**, and the Command Strings path in
[`BRANDS.md`](BRANDS.md) remains the supported way RFutils talks to Shure gear.

There is now an implementation elsewhere: `mic-adapter-shure-acn` in
[Dante-BabelBox](https://github.com/stoatworks-labs/Dante-BabelBox) implements
the SLPv2 discovery of §3 and the property decoding of §5, with the decoder
unit-tested against real receiver frames from the captures. It is read-only and
**cannot open its own session** — see below.

Two things constrain any implementation, including that one:

- **Telemetry is only visible with a mirrored port.** The receiver unicasts its
  `EVENT` messages to the console, so on an ordinary switch port a third-party
  listener sees nothing. Discovery, being multicast, works anywhere.
- **The session handshake cannot be verified.** The capture described in §4 as
  containing the full JOIN / CONNECT / SUBSCRIBE sequence is **lost** — it is
  not in the `dante-captures` archive and not on the machine, and no surviving
  capture contains a single JOIN. The sequence above is preserved as prose, but
  the byte-level field layouts are not. Re-recording a receiver power-cycling
  while mounted is what unblocks an active client.

Nothing was ever transmitted to the receiver: every finding above is passive
observation of a console and a receiver talking to each other, plus one
read-only TFTP request that went unanswered.
