# Ledger signing harness

Two scripts, same goal: a device-signed, testnet-settled XRPL transaction with
the Clear Signing preview shown first. **No hardware or booth needed** — the
Ledger workshop repo (cloned at `vendor/ledger-workshop/`, gitignored) ships
prebuilt XRP app binaries for every device model.

## Run the emulator (Docker Desktop must be running)

```sh
docker pull ghcr.io/ledgerhq/speculos:latest
cd vendor/ledger-workshop/xrpl-hackathon/speculos && ./run-speculos.sh stax
```

Wait for `[run-speculos] Speculos is ready`. Screen: http://127.0.0.1:5000 or
`open vnc://127.0.0.1:41000` (password `speculos`). First run writes a random
seed to `.seed` so your testnet address stays stable.

macOS gotcha: port 5000 is often taken by AirPlay Receiver — turn it off in
System Settings if Speculos won't bind.

## Script 1 — `sign-dmk.ts` (the bounty path)

Uses the **pre-release `@ledgerhq/device-signer-kit-xrp`** via the Device
Management Kit + Speculos transport. Full flow: get address → faucet-fund →
autofill payment → **Clear Signing preview** → sign on device → submit →
explorer link.

```sh
npx tsx harness/sign-dmk.ts
```

Every rough edge in the kit → `FEEDBACK.md` + issue on
[LedgerHQ/device-sdk-ts](https://github.com/LedgerHQ/device-sdk-ts). Ledger
judges this as much as code.

## Script 2 — `sign-hw-app.ts` (stable fallback)

Same idea on the older, stable `@ledgerhq/hw-app-xrp` stack. Keep it as the
known-good path if the pre-release kit breaks.

## Key API facts (from Ledger's workshop)

- Serialize with `encode(tx)`, **not** `encodeForSigning()` — the XRP device
  app adds the signing prefix itself.
- `SigningPubKey` = device public key, **uppercase** hex, set before encoding.
- The signature comes back as DER; it goes in `TxnSignature`, uppercase hex.
- Signer methods return `{ observable, cancel }`, not promises.
- Derivation path `44'/144'/0'/0/0`; bump the 3rd index for more accounts.
- Some newer tx types need the device's **Blind signing** setting — which is
  exactly the problem this project exists to fix. Use that line in the pitch.

## Real device (booth, tomorrow)

- Node: swap the transport for `@ledgerhq/device-transport-kit-node-hid`.
- Browser demo: `@ledgerhq/device-transport-kit-web-hid` (Chrome/Edge/Brave).
- Install the XRP app on the device via Ledger Wallet first.
