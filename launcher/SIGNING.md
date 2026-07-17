# Signing & notarizing the RFutils desktop app (optional)

**You do not need any of this to use RFutils.** By default the `.dmg` is
**unsigned** — macOS Gatekeeper just asks you to right-click the app → **Open**
the first time, and it runs fine after that. The release workflow builds and
ships that unsigned `.dmg` automatically.

This page is only relevant **if** you have a **paid Apple Developer Program**
membership and want a signed + notarized build that opens with a normal
double-click. Notarization is a paid-account feature — there's no free path — so
if you don't have an account, ignore this file. When the secrets below are
absent the [`release-macos`](../.github/workflows/release-macos.yml) workflow
simply produces the unsigned `.dmg`; add them and it produces a signed one. You
add them in the repo yourself — they are never entered or stored anywhere else.

## What you'd need

A **paid Apple Developer Program** membership and a **Developer ID Application**
certificate (the cert type for distributing apps *outside* the App Store).

## Secrets to create

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | What it is / how to get it |
|---|---|
| `APPLE_CERTIFICATE` | Your *Developer ID Application* certificate exported from **Keychain Access** as a `.p12`, then base64-encoded: `base64 -i cert.p12 \| pbcopy`. Paste the result. |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12`. |
| `APPLE_SIGNING_IDENTITY` | The certificate's full name, e.g. `Developer ID Application: Your Name (TEAMID)`. Find it with `security find-identity -v -p codesigning`. |
| `APPLE_ID` | Your Apple ID email (used for notarization). |
| `APPLE_PASSWORD` | An **app-specific password** for that Apple ID — create one at [appleid.apple.com](https://appleid.apple.com) → Sign-In & Security → App-Specific Passwords. **Not** your real Apple ID password. |
| `APPLE_TEAM_ID` | Your 10-character Team ID (Apple Developer account → Membership). |

> Handle the `.p12` and passwords yourself — export, base64, and paste them
> straight into GitHub's secret fields. Don't commit them or share them here.

## How it builds

`release-macos.yml` (on a `v*` tag or manual run):

1. builds + stages the embedded app (`scripts/prepare.sh`),
2. imports `APPLE_CERTIFICATE` into a temporary keychain (only if present),
3. **pre-signs the embedded Node binary** (`scripts/sign-embedded.sh`) with the
   hardened runtime + [`entitlements.plist`](src-tauri/entitlements.plist) — a
   nested Mach-O that must be signed for the bundle to notarize,
4. runs `tauri build`, which signs the `.app`/`.dmg` and, when the notarization
   secrets are present, submits it to Apple and staples the ticket,
5. attaches the `.dmg` to the GitHub release.

If the certificate secret is absent, steps 2–3 are skipped and it produces an
unsigned `.dmg`.

## Building a signed `.dmg` locally

On your Mac with the certificate in your keychain:

```bash
cd launcher
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
npm ci
bash scripts/prepare.sh
bash scripts/sign-embedded.sh
npm run tauri build
```

The signed, notarized `.dmg` lands in
`src-tauri/target/release/bundle/dmg/`.
