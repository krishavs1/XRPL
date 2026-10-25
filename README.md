# XRPL Clear Signing

**Stop blind-signing on the XRP Ledger.** A display-metadata standard
(ERC-7730-style, for XRPL) plus a reference TypeScript parser that turns any
XRPL transaction — JSON or raw signing blob — into human-readable,
risk-annotated intent. Enriched with live `simulate` dry runs (XLS-69) and
rendered all the way down to a Ledger device.

Built in 36 hours at the AI & Fintech XRPL Hackathon, NYC (Oct 24–25, 2026).

## The problem

Every XRPL wallet hand-rolls its own transaction rendering; hardware devices
show raw fields at best. Nothing warns you that a TrustSet named "RLUSD" points
at a scam issuer, that a Payment has the partial-payment flag set, or that one
Batch signature (XLS-56) executes eight hidden transactions.

## What this is

1. **`spec/transaction-display-metadata.md`** — a draft standard: display
   metadata format, account registry with impersonation detection, standardized
   risk codes, Batch recursion rules, device rendering profile.
2. **`packages/core`** (`xrpl-clear-signing`) — the reference implementation:
   `explain(blobOrJson) → DisplayIntent` with typed renderers for TrustSet,
   Payment, OfferCreate, EscrowCreate, Batch (+ safe fallback for everything
   else), plus `simulateTx()` for XLS-69 dry-run enrichment.
3. **`apps/demo`** — web app: paste hex → see intent + warnings; one click
   simulates against testnet/QuickNode and shows projected balance changes.
4. **`harness/`** — Ledger signing via Speculos or a physical device, with the
   Clear Signing preview shown before the device prompt.

## Quickstart

```sh
npm install
npm test        # core library tests
npm run demo    # web demo at http://localhost:5173
# Ledger flow (after starting Speculos — see harness/README.md):
npx tsx harness/sign-hw-app.ts
```

## Demo script (90s)

1. Paste the scam TrustSet blob → preview screams: unverified issuer,
   effectively-unlimited limit, **"RLUSD" impersonation**.
2. Load the legit RLUSD TrustSet → clean preview, verified issuer ✓.
3. Hit **Simulate** → projected balance changes from a live XLS-69 dry run.
4. Load the Batch → one signature, two hidden transactions, unfolded with their
   warnings bubbled up.
5. Cut to the Ledger device: same intent on the secure screen. Sign.

## Prize mapping

- **Protocol Innovation track** — a standards draft (to be posted to
  XRPL-Standards Discussions) + reusable tooling/infrastructure.
- **Ledger bounty** — `device-signer-kit-xrp`/Speculos integration, Clear
  Signing beyond EVM, DX feedback in `FEEDBACK.md` + upstream issues.
- **QuickNode bounty** — simulate + submit through QuickNode XRPL RPC; live
  feed via WSS/Streams (set your endpoint in the demo).

## TODO (build order)

- [ ] **Speculos signing working end-to-end** (tonight — highest variance)
- [ ] `device-signer-kit-xrp` port + file breakages upstream (FEEDBACK.md)
- [ ] Add testnet RLUSD issuer (from booth) to `registry/` + demo samples
- [ ] QuickNode endpoint env + live transaction feed panel in demo
- [ ] AMMDeposit + OfferCreate slippage-vs-simulate check
- [ ] Post spec to XRPL-Standards GitHub Discussions; link here
- [ ] Record fallback demo video
