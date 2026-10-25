# XRPL Clear Signing

**Stop blind-signing on the XRP Ledger.** A display-metadata standard
(ERC-7730-style, for XRPL) plus a reference TypeScript parser that turns any
XRPL transaction — JSON or raw signing blob — into human-readable,
risk-annotated intent. Enriched with live `simulate` dry runs (XLS-69) and
rendered against a Ledger device.

Built at the AI & Fintech XRP Ledger Hackathon, NYC (Oct 24–25, 2026).

## The problem

Every XRPL wallet hand-rolls its own transaction rendering; hardware devices
show raw fields at best, and newer transaction types fall back to blind
signing. Nothing warns you that a TrustSet named "RLUSD" points at a scam
issuer, that a Payment has the partial-payment flag set (so the stated amount
isn't what arrives), or that one Batch signature (XLS-56) executes several
hidden transactions. Ethereum answered this with ERC-7730; XRPL has no
equivalent.

## What this is

1. **`spec/transaction-display-metadata.md`** — a draft standard: the display
   metadata format, an account registry with impersonation detection,
   standardized risk codes, Batch recursion rules, and a device rendering
   profile. `spec/DISCUSSION-POST.md` is the pre-proposal write-up for
   XRPL-Standards.
2. **`packages/core`** (`xrpl-clear-signing`) — the reference parser:
   `explain(blobOrJson) → DisplayIntent` with typed renderers for TrustSet,
   Payment, OfferCreate, EscrowCreate, AMMDeposit, and Batch, plus a safe
   fallback for every other type, and `simulateTx()` for XLS-69 dry-run
   enrichment.
3. **`apps/demo`** — a web tool: paste hex or JSON, see the decoded intent and
   risk warnings, simulate against the network, stream live ledger
   transactions, and sign on a Ledger (Speculos emulator or a real device).
4. **`harness/`** — standalone Ledger signing scripts: `sign-dmk.ts` (the
   pre-release `device-signer-kit-xrp`) and `sign-hw-app.ts` (the stable
   `hw-app-xrp` fallback).

## What's live vs. static

Being explicit, because it matters for a security tool:

- **Static:** the account registry (`packages/core/registry/issuers.json`, a
  small hand-maintained JSON file). Issuer names and the "verified" marks come
  from it, not from the ledger. The UI shows "unknown account" when an address
  isn't in it.
- **Live:** `simulate` dry runs, account balances, the faucet, the transaction
  feed, and signing/submission all hit a real XRPL endpoint (public testnet by
  default; point it at QuickNode via the endpoint fields).
- **Testnet:** everything here runs on testnet. The demo fixtures use
  throwaway testnet issuer accounts, not mainnet RLUSD.

## Quickstart

```sh
npm install
npm test        # core library tests (9 passing)
npm run demo    # web demo at http://localhost:5173
```

For the Ledger flow, start the Speculos emulator first (see
`harness/README.md`), then either use the "sign on device" button in the demo
or run `npx tsx harness/sign-dmk.ts`.

> **Emulator note:** Speculos serves one client at a time. Don't run the
> harness and the browser demo (or two browser tabs) against it at once — a
> concurrent APDU exchange surfaces as a generic "Unexpected device exchange
> error". Use one client; after any device error, reload the tab.

## Demo script (90s)

1. Load the scam TrustSet fixture → the preview flags unverified issuer,
   effectively-unlimited limit, and **"RLUSD" impersonation**.
2. Hit **simulate** → the ledger returns `tesSUCCESS`: a scam trustline is a
   perfectly valid transaction. Neither the ledger nor the device can see the
   scam — only the metadata layer does.
3. Load the legit RLUSD TrustSet → clean preview, verified issuer ✓.
4. Load the Batch → one signature, two inner transactions unfolded, their
   warnings bubbled up.
5. Sign on the Ledger → the device shows the same transaction on its secure
   screen, and it settles on testnet.

## Layout

```
packages/core   the xrpl-clear-signing library (parser, registry, simulate)
apps/demo       the web tool
harness         standalone Ledger signing scripts
spec            the draft standard + the XRPL-Standards discussion post
FEEDBACK.md     DX findings on the pre-release Ledger kit
PITCH.md        pitch notes and prize-track mapping
```

## Status

- [x] Parser: 6 transaction types + safe fallback, 9 passing fixture tests
- [x] Risk warnings incl. impersonation, partial-payment, Batch, AMM slippage
- [x] `simulate` (XLS-69) dry runs with projected balance changes
- [x] Live ledger transaction feed (WebSocket `subscribe`)
- [x] Device signing end-to-end via `device-signer-kit-xrp` on Speculos
- [x] Draft spec + XRPL-Standards discussion post written
- [ ] Post the spec to XRPL-Standards Discussions and link it here
- [ ] Swap in the event's testnet RLUSD issuer (booth) + run on a real device
- [ ] Point the demo at a QuickNode endpoint for the live feed + simulate
- [ ] File the `FEEDBACK.md` findings as issues on `LedgerHQ/device-sdk-ts`
- [ ] Record a fallback demo video
