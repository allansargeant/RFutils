# Capturing a Receiver's Control Traffic

*Field guide — network capture.* How to record a wireless receiver talking to its own
control software, so a monitoring adapter can be built for it.

Free software · No specialist network gear for the common case · ~20 minutes

## Why we're asking

RFutils can coordinate and export for **any** UHF wireless brand — that part needs
nothing from the network. Live discovery, monitoring and programming is different: it
needs a per-brand adapter that speaks the receiver's own control protocol, and only two
of those protocols are published.

| Brand | What's missing | What a capture would unlock |
|---|---|---|
| **Lectrosonics** (DSQD, D Squared, DCR822) | The adapter is **already written** — discovery, telemetry, programming, dry-run, the lot. Only its wire format is an unverified placeholder | The highest-value capture on this list. It is a [one-file correction](../packages/server/src/monitor/discovery/lectrosonicsProtocol.ts): a port number, a terminator, and two functions |
| **Wisycom** (MCR54, MTP) | The "Wisycom Remote Protocol" that Wisycom Manager speaks is proprietary and undocumented | A new adapter — discovery and telemetry |
| **Sony** (DWX / DWR-R03D) | Wireless Studio's IP control is proprietary | A new adapter |
| **Sound Devices** (A20-Nexus, Astral) | The IP web-app API is proprietary | A new adapter |
| **MiPro** (ACT series) | RCS2.Net rides on a proprietary ACT-BUS | A new adapter |
| **Sennheiser** (EW-DX, EW-D, D6000/9000) | SSC *is* documented, but our adapter is a skeleton and has never met hardware | Confirmation, and the parts the spec leaves vague |

The two that *are* built from published specs — Shure Command Strings and Sennheiser SSC
— are also the two we can already test. Everything else on that table stays at "❌" until
somebody with the gear records five minutes of it doing something ordinary.

See [`BRANDS.md`](BRANDS.md) for the full support table.

> **⚠ Bench, not showtime.** Do this on a spare receiver before or after a show. Nothing
> here transmits anything at the receiver, but a capture is not worth any risk to a live
> rig.

## Which method you need

The answer depends entirely on **who the receiver is talking to**. Work that out first —
it's the only decision in this guide that matters.

| Your situation | Method | Effort |
|---|---|---|
| The receiver is controlled by vendor software **on your laptop** (Wireless Designer, Wisycom Manager, Wireless Studio, the A20 web app…) | **[A — capture on the same machine](#method-a--capture-on-the-machine-running-the-software)** | Nothing to set up |
| The vendor software runs on **a different machine** from the one you want to capture on | **[B — mirror a switch port](#method-b--mirror-a-switch-port)** or a laptop bridge | ~15 minutes |
| The receiver is **mounted on a console** and reporting to it | **[B — mirror a switch port](#method-b--mirror-a-switch-port)**, and only that | ~15 minutes |

Most people are in the first row, and the first row needs no network setup at all.

## Method A — capture on the machine running the software

If the vendor's control software is on your laptop, every packet between it and the
receiver already arrives at your laptop's own network interface. There is nothing to
bridge, mirror, or re-cable. Wireshark just watches.

### 1. Install Wireshark

Free at [wireshark.org](https://www.wireshark.org).

- **macOS** — the installer also installs ChmodBPF. Say yes when it asks, or capture
  needs `sudo` every time.
- **Windows** — Npcap, its packet driver, installs alongside it automatically.
- **Linux** — `sudo apt install wireshark`; say yes to letting non-root users capture,
  then `sudo usermod -aG wireshark $USER` and log back in.

### 2. Wire it up the way you normally would

Receiver and laptop on the same network — direct cable, or through whatever switch you'd
normally use. No special topology.

**Turn Wi-Fi off** while you do this. It keeps the capture down to the conversation we
want, and stops the vendor software finding the receiver by a route you aren't watching.

### 3. Start Wireshark first, on the wired interface

Pick your Ethernet interface — not `any`, not Wi-Fi — and hit the blue shark-fin
**Start** button **before** you launch the vendor software or power the receiver on. The
discovery handshake at the very start is often the part nobody has ever seen, and it only
happens once.

### 4. Power the receiver on

Wait about 30 seconds for the software to find it.

### 5. Do ordinary things, one at a time

This is the part that makes a capture useful rather than merely large. Leave a couple of
seconds between each, so each change is an obvious island in the timeline:

1. Let it sit idle for 30 seconds once connected — that establishes what the routine
   telemetry heartbeat looks like.
2. **Change a frequency** on one channel from the software.
3. **Change the same frequency at the receiver's front panel** instead. (These two are
   often completely different messages, and the second one is how we learn what the
   receiver reports *unprompted*.)
4. **Rename a channel.**
5. **Change squelch or output gain**, if the receiver has it.
6. **Turn a transmitter on**, and let it pair.
7. **Walk the transmitter out of range and back** — RF level and diversity switching
   moving across a range is worth far more than a single healthy reading.
8. **Let a transmitter's battery report drop**, if you have one that's part-charged.
9. **Mute and unmute** a channel.
10. **Power the receiver off and on again** with the capture still running.

If you only have time for three: the idle heartbeat, one frequency change from the
software, and one transmitter walking out of range.

### 6. Stop, save, and note what you did

**Stop**, then **File → Save As**. Name it for the gear —
`dsqd_wirelessdesigner_2026-08-06.pcapng`.

Then jot down, in any form at all: the exact model and firmware version, what software
version drove it, and roughly when in the recording each of the steps above happened
("~1:10 frequency change from the app"). **That note is worth as much as the file.**
Without it we are guessing which packet is which event; with it, decoding is mechanical.

## Method B — mirror a switch port

Use this when the controller isn't the machine you're capturing on — most importantly
when a **receiver is mounted on a console**. That receiver unicasts its telemetry
straight to the console, so a laptop plugged into an ordinary switch port sees *nothing*,
and there may be no cable you can insert yourself into. Mirroring is the only way.

(This is exactly how [`SHURE-ACN.md`](SHURE-ACN.md) came about — a QLX-D on a Yamaha
console turned out not to speak Shure's documented Command Strings at all.)

### The cheap route: a UniFi USW-Flex-Mini

Owning a mirroring switch used to mean borrowing something from IT. The **UniFi
USW-Flex-Mini** is a palm-sized five-port gigabit switch for about £25 / $30, and port
mirroring is a listed feature — *"operation mode (switching or mirroring) per port"*,
straight off Ubiquiti's own datasheet.

> **⚠ The catch — read this before you buy one.** The Flex Mini has **no web interface of
> its own.** It has to be adopted by a UniFi Network controller before you can configure
> anything: a Dream Machine, a Cloud Key, or the free UniFi Network Application on a Mac,
> PC, Raspberry Pi or in Docker. If you already run UniFi anywhere, you're two minutes
> from a mirror port. If you don't, a laptop bridge is less work — see Method C.

**Wire it up.** Power the switch from its USB-C supply if you have one, which leaves all
five ports free; port 1 is the only one that accepts PoE in, so over PoE it's already
spoken for.

| Port | Plug in |
|---|---|
| 2 | The receiver |
| 3 | The console, or the machine running the vendor software |
| 4 | Your laptop — the capture port |

Leave the laptop on **Wi-Fi** for reaching the controller. The reason is two paragraphs
down and it isn't optional.

**Turn port 4 into a mirror.** In UniFi Network: **Devices** → the Flex Mini → **Ports**
→ click **port 4**, your laptop's → **Edit** → set **Operation** to **Mirroring** → set
**Mirroring Port** to **2**, the receiver's → **Apply Changes**. You are always editing
the port the copy comes *out of*, then naming the port being *copied*; newer UniFi
versions wrap this in a port profile but ask the same two questions.

**One source port is enough.** UniFi mirrors strictly one port to one port — there's no
"mirror everything onto port 4", and no CLI to get around it, since the Flex Mini doesn't
offer SSH. It doesn't matter here: mirroring copies traffic in **both directions**, so
port 2 gives you everything the receiver sends *and* everything sent to it. That's the
whole conversation from one port.

**Your laptop's Ethernet goes deaf.** A mirror destination only spits copies out; it
won't carry a working connection, so the laptop can't reach the controller or the
internet through it while mirroring is on. That's correct behaviour — and why the
controller has to be reachable over Wi-Fi.

**Then capture exactly as in Method A**, steps 3 to 6, on your laptop's ordinary Ethernet
interface. When you're done, set port 4's **Operation** back to **Switching** — a port
left mirroring looks simply broken to whoever plugs in next.

### Any managed switch you already own

Same two questions, different menus — and most switches will mirror several source ports
at once rather than just one. Needs admin access to the switch.

## Method C — a laptop bridge

If you have no managed switch and the controller is a separate machine, your laptop can
sit inline between the two and pass traffic through unchanged, with Wireshark watching.
Rather than repeat it here, the sibling project has a step-by-step field guide with an
edition per OS, because the bridging step is the OS-specific part:

- [Windows](https://github.com/stoatworks-labs/Dante-BabelBox/blob/main/docs/capture-guide-windows.md)
- [macOS](https://github.com/stoatworks-labs/Dante-BabelBox/blob/main/docs/capture-guide-macos.md)
- [Linux](https://github.com/stoatworks-labs/Dante-BabelBox/blob/main/docs/capture-guide-linux.md)

Those are written around a mixing desk and a stagebox, but the network problem is
identical — substitute "receiver" for "stagebox" and "the machine running the vendor
software" for "desk", and every step applies.

## Before you send it

**Check what else is in there.** A capture records everything that reached that
interface, not just the receiver. On an isolated bench network that's nothing; on an
office or venue network it can include other traffic entirely unrelated to the gear. Two
ways to keep it clean, in order of preference:

1. **Capture on an isolated network** — receiver, controller, laptop, and nothing else.
   Best outcome, and usually easy on a bench.
2. **Filter to the receiver before sending.** Open the file, find the receiver's IP,
   enter `ip.addr == 192.168.1.50` in the display filter bar, then **File → Export
   Specified Packets → All packets / Displayed**. That leaves only the conversation we
   asked for.

We only ever need the receiver's own traffic. If in doubt, filter.

**Then open an issue** on [the repo](https://github.com/stoatworks-labs/RFutils/issues)
saying what gear you've got — before you attach anything, so we can tell you if there's a
better shape for it. Include:

- Receiver make, model and firmware version
- The control software and its version
- Your rough timeline of what happened when
- The `.pcapng`, unedited apart from any filtering above

## If something's not working

**Wireshark's interface list is empty, or it asks for a password every time.**
macOS: the ChmodBPF helper wasn't installed — re-run the `.pkg` installer with that step
ticked and log out and back in. Linux: you're not in the `wireshark` group yet, or
haven't logged back in since being added.

**The vendor software finds the receiver but Wireshark shows nothing.**
You're almost certainly capturing on the wrong interface. Turn Wi-Fi off entirely and
capture on the wired interface — if the software can still see the receiver with Wi-Fi
off, the traffic is definitely on the wire you're watching.

**There's no "Mirroring" option on the switch's ports.**
The switch isn't adopted yet, or is on old firmware — check for a firmware update in
UniFi Network, let it apply, and look again. If it still isn't there, use Method C.

**The mirror is set up but Wireshark sees nothing.**
Check you edited the *laptop's* port and pointed it at the *receiver's*, not the other
way round — backwards produces exactly this.

**The capture is enormous.**
Something high-bandwidth is on the mirrored port — Dante audio, most likely. In
Wireshark before you start: **Capture → Options → Output**, tick **Create a new file
automatically** every **100 MB** and **Use a ring buffer with 20 files**.

---

Part of [RFutils](https://github.com/stoatworks-labs/RFutils). A `.pcapng` plus a few
lines about what you did is all we need.
