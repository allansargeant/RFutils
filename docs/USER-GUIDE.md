# RFutils user guide

RFutils is a browser-based toolkit for radio-mic frequency coordination. It replaces three
separate tools with one app.

> **Before you rely on this for a show:** most of the file formats RFutils reads and writes
> are *reverse-engineered from real exports*, because neither Shure nor Sennheiser publishes
> full specifications for them. **Open every export in your own copy of Wireless Workbench
> or WSM and check it before the show.** Treat anything marked experimental as exactly that.

---

## What it does

| Tab | What it's for |
|---|---|
| **Convert › Coordination files** | Move coordination data between Shure Wireless Workbench (WWB) and Sennheiser Wireless Systems Manager (WSM), or in and out of plain CSV |
| **Convert › Ofcom PMSE licence** | Turn an Ofcom PMSE licence schedule PDF into importable frequency data |
| **Monitor** | Discover Shure/Sennheiser/AES67 receivers on the network and watch audio, battery and RF |
| **Coordination** | Calculate an intermodulation-clean set of frequencies |
| **Allocation** | Work out which frequencies go to which channel |
| **Deployment** | Push assignments out to real receivers |
| **Inventory** | Keep a list of the receivers and transmitters you own |

---

## Running it

### As a desktop app
RFutils ships as a tray application (built on av-launcher, with a Node runtime embedded).
Start it, pick a network interface and port, press **Start**, then **Open**.

> **On macOS, if the app opens but the server never starts:** this is almost always
> Gatekeeper. For an unsigned app bundling helper binaries, approving the *app* does not
> unquarantine the *helpers* — they're terminated silently, with no error shown. See the
> release notes for the unquarantine step.

### From source
```bash
npm install
npm run dev
```
Then open **http://localhost:8420**.

**No hardware? Use demo mode:**
```bash
npm run dev:demo
```
This runs with simulated receivers, so you can explore discovery, monitoring and the whole
UI without a single real device on the network.

---

## Typical workflows

### Converting a coordination file
1. Go to **Convert › Coordination files**.
2. Drop in your `.wwb`, WSM export or CSV. The format is detected automatically.
3. For a plain CSV, RFutils reads the header and suggests which column is which. **Check
   the suggested mapping** — it's a best guess from the column names.
4. Choose your export format and download.
5. **Open the result in WWB or WSM and confirm it looks right** before using it.

### Importing an Ofcom PMSE licence
1. Go to **Convert › Ofcom PMSE licence**.
2. Upload the licence schedule PDF exactly as Ofcom issued it.
3. If you get *"not a recognisable PMSE licence schedule"*, the file was readable but isn't
   the expected document — check you've uploaded the schedule itself rather than a covering
   letter or a re-saved copy.
4. Export to your coordination software.

### Monitoring receivers
1. Go to **Monitor**. Devices on the local network are discovered automatically.
2. You'll see audio level, battery and RF status per channel.
3. If nothing appears: RFutils and the receivers must be on the same subnet, and discovery
   traffic must not be blocked by a firewall or by client isolation on the wireless network.

### Programming receivers — read this before you press it
**Deployment sends commands to real receivers, which may be in use.**

RFutils defaults to a **dry run**: it shows what it *would* send without transmitting
anything. That default is deliberate. Only disable it when you're certain the right devices
are targeted and it's safe to change them — not during a show, unless that's exactly what
you intend.

Supported control transports today are Shure command strings and the Lectrosonics network
protocol. Devices that match neither are listed with no transport, and won't be programmed.

---

## Troubleshooting

**Nothing is discovered in Monitor.**
Check you're on the same subnet as the receivers, that no firewall is blocking discovery,
and that the wireless network isn't isolating clients from each other. To confirm the app
itself is fine, run `npm run dev:demo` — if simulated devices appear, the app works and the
problem is on the network.

**A CSV imports with the wrong values in the wrong fields.**
The column mapping guessed wrong. Re-import and set the mapping by hand.

**An export doesn't look right in WWB/WSM.**
Expected occasionally, and the reason for the warning at the top of this guide — these
formats are reverse-engineered. Please report the case with a sample file.

**The port is already in use.**
Set `RFUTILS_SERVER_PORT` to something else.

**Monitoring is causing problems and I just want the converters.**
Set `RFUTILS_DISABLE_MONITOR=1`, or run `npm run dev:verify`.

---

## Where your data lives

Inventory is stored server-side. Note that saving inventory **replaces the whole list**
rather than merging into it, so the app always writes the complete set.

There is **no authentication**, and the server listens on all interfaces by default. On a
shared or untrusted network, bind it to `127.0.0.1` or firewall the port — otherwise anyone
who can reach it can read your inventory and send commands to your receivers.
