# AGENTS.md — bringing an LLM up to speed on RFutils

Orientation for an AI assistant (or a new human) picking this project up cold. `CLAUDE.md`
holds the short command reference; this file explains the model and the traps.

---

## 1. What this is

A browser-based **RF-coordination and wireless-mic suite** that unifies three previously
separate tools into one package, with room to grow into full frequency coordination,
allocation and deployment services.

| Merged tool | What it did | Where it lives now |
|---|---|---|
| `wsm-wwb-bridge` | Move coordination data between Shure Wireless Workbench and Sennheiser Wireless Systems Manager, plus any CSV | **Convert › Coordination files** |
| `pmse-to-wwb` | Convert an Ofcom PMSE licence schedule PDF into WWB import files | **Convert › Ofcom PMSE licence** |
| `MicWizard` | Discover networked Shure/Sennheiser/AES67 receivers, monitor audio/battery/RF | **Monitor** |

Node/TypeScript, npm-workspaces monorepo. Public repo (github.com/allansargeant/RFutils).

## 2. The thing to understand before touching a parser

**Most of these formats are reverse-engineered from real exports and vendor gear, not from
published schemas.** Neither Shure nor Sennheiser publishes full specifications for most of
them.

Two consequences:

- **Never "clean up" a parser to match what the format *ought* to look like.** The oddities
  are usually real observations from real files.
- The PMSE PDF parser has been **validated against a real Ofcom licence**, and the parsers
  ported from wsm-wwb-bridge were **byte-verified** against the Python originals. Preserve
  that standard: verify against a real artefact, not against your model of the format.

**Duplicate-implementation warning:** the standalone `wsm-wwb-bridge` repo still holds the
original **Python** parsers, and this repo holds **TypeScript** ports. Before extending
either, work out which is canonical for the change you're making — otherwise the two drift.

## 3. Layout

```
packages/
  shared   Types + parsers (WSM / WWB / PMSE). Must be built first.
  server   Backend (@rfutils/server)
  web      Frontend (@rfutils/web) - React, tab-per-tool
docs/      BRANDS.md, PLUGINS.md, plugins/, screenshots/
```

**`shared` must be built before `server` or `web`.** Every dev and build script does this
first (`npm run build:shared`). If you see phantom type errors, that's usually why.

## 4. Commands (from repo root)

```bash
npm run dev          # server (port 8420) + web
npm run dev:demo     # with mock devices - no hardware needed
npm run dev:verify   # monitor disabled
npm run build
npm run typecheck    # runs across shared, server and web
npm test             # server package
```

`dev:demo` is the one to reach for: device discovery and monitoring can be exercised with no
receivers on the network.

## 5. UI structure

`packages/web/src/App.tsx` imports its six tabs **directly** — there is no dynamic import,
no lazy loading and no string-keyed tab registry. If you add a tab, wire it into `App.tsx`
explicitly.

(A `PlaceholderTab` component previously rendered "Planned" stubs for the coordination,
allocation and deployment tabs. Those three now have real implementations, so it was removed
as dead code. Don't reintroduce the pattern — add the real tab.)

## 6. Status and honesty requirements

The README carries an explicit warning that must not be softened: several formats and
protocols are reverse-engineered, and users are told to **verify every export against their
own WWB/WSM install before relying on it for a live show**.

When you write user-facing text for this project, keep that posture. "Experimental output"
means experimental.

## 7. Conventions

- Ships as its own desktop app via **av-launcher**, which for this project **embeds a Node
  runtime**. Note the macOS Gatekeeper trap common to all av-launcher apps: for an unsigned
  `.app` bundling helper binaries, approving the app does *not* unquarantine the payload —
  helpers are SIGKILLed silently.
- Multi-platform release CI; cross-compile macOS x86_64 on `macos-14`, never `macos-13`.
- Public repo. "Commit" means commit **and** push.
