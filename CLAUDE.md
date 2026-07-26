# RFutils

Unified browser app for RF/wireless-mic coordination — merges wsm-wwb-bridge + pmse-to-wwb + MicWizard. Node/TS npm-workspaces monorepo (shared + server + web). PMSE PDF parser validated against a real licence; parsers ported from wsm-wwb-bridge (byte-verified).

## Commands (npm, from repo root)
- Dev (server+web): `npm run dev` — server on port 8420
- Dev, mock devices: `npm run dev:demo`
- Dev, no monitor (verify): `npm run dev:verify`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Test: `npm test` (server package)
- Build shared only: `npm run build:shared`

## Layout (packages/)
- `shared` — types + parsers (WSM/WWB/PMSE); build before server/web (`build:shared`)
- `server` — backend (`@rfutils/server`)
- `web` — frontend (`@rfutils/web`)

## Notes
- `shared` must be built before server/web — every dev/build script does this first.
- Parsers here vs the standalone wsm-wwb-bridge (Python): check which is canonical before extending.
- Public repo (github.com/allansargeant/RFutils). "Commit" = commit **and** push.
