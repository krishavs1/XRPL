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
   `explain(blobOrJson) → DisplayIntent` for TrustSet, SetRegularKey,
   SignerListSet, AccountSet and AccountDelete (JSON metadata documents) and
   Payment, OfferCreate, EscrowCreate, AMMDeposit and Batch (TypeScript
   renderers), plus a safe fallback for every other type, and `simulateTx()`
   for XLS-69 dry-run enrichment.
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
npm test        # core library tests
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
5. Sign on the Ledger → the scam's sign button stays locked until you
   acknowledge its danger warnings. Side by side: today's Ledger XRP app shows
   raw fields that look identical for the scam and the real issuer; the
   clear-signing device preview leads with "⚠ CURRENCY_IMPERSONATION" and ends
   with "Reject recommended". It settles on testnet.

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

- [x] Parser: 10 transaction types (5 via JSON metadata documents) + safe fallback
- [x] Risk warnings incl. impersonation, partial-payment, Batch, AMM deposit risks
- [x] `simulate` (XLS-69) dry runs with projected balance changes
- [x] Live ledger transaction feed (WebSocket `subscribe`)
- [x] Device signing end-to-end via `device-signer-kit-xrp` on Speculos
- [x] Draft spec + XRPL-Standards discussion post written
- [ ] Post the spec to XRPL-Standards Discussions and link it here
- [ ] Swap in the event's testnet RLUSD issuer (booth) + run on a real device
- [ ] Point the demo at a QuickNode endpoint for the live feed + simulate
- [ ] File the `FEEDBACK.md` findings as issues on `LedgerHQ/device-sdk-ts`
- [ ] Record a fallback demo video

### Spec vs. implementation gaps

- [x] JSON metadata documents: TrustSet, SetRegularKey, SignerListSet,
      AccountSet and AccountDelete render from `packages/core/metadata/*.json`
      via the interpreter in `src/metadata.ts`; callers can add types with
      `explain(tx, { metadata })`.
- [ ] Move Payment, OfferCreate, EscrowCreate and AMMDeposit to metadata
      documents (Batch stays code: it's a pipeline rule).
- [x] Device profile: `toDeviceScreens()` in `packages/core/src/device.ts`
      implements the spec's rules; the demo shows it next to the live
      Speculos screen and gates signing on danger warnings.
- [ ] On-device clear signing: the Ledger XRP app (C firmware) still renders
      raw fields. Port the device profile there, or propose it to Ledger.
- [ ] Per-network registries: `issuers.json` is labelled mainnet but contains
      the testnet RLUSD issuer, and `explain()` takes no network option. Split
      the file and select by network.
- [ ] Registry signing/pinning: the spec says "signed", the file is plain
      JSON with no hash check.
- [ ] Named flags for EscrowCreate and AMMDeposit (`flags` format).
- [ ] Spec risk-code list is missing 7 codes the parser emits
      (`MALFORMED_PARTIAL_XRP`, `ESCROW_NO_RELEASE_GATE`, `FILL_OR_KILL`,
      `AMM_MODE_INVALID`, `SINGLE_SIDED_DEPOSIT`, `NO_DEPOSIT_BOUND`,
      `POOL_SEEDING`).

### Missing risk checks

- [ ] Batch: flag inner transactions whose `Account` differs from the outer
      signer (XLS-56 `BatchSigners`).
- [ ] Payment: warn on unverified destinations and run currency
      impersonation checks on issued `Amount` / `SendMax`.
- [x] Account-takeover / drain types as metadata documents: `SetRegularKey`,
      `SignerListSet`, `AccountSet`, `AccountDelete`.
- [ ] Turn `simulate` results into risk codes (non-`tesSUCCESS` result,
      large XRP balance drop).

### Housekeeping

- [ ] Fill in the empty sections of `FEEDBACK.md`.
- [ ] Tests for OfferCreate, EscrowCreate, `MISSING_DESTINATION_TAG`,
      `simulateTx`, and AMM LP currency decoding.
- [ ] Remove the dated "tomorrow" / "booth" wording from the READMEs after the
      event.
