# Pitch notes — XRPL Clear Signing

## One-liner

**Stop blind-signing on the XRP Ledger.** An ERC-7730-style display-metadata
standard for XRPL plus the reference parser — human-readable, risk-annotated
transaction previews, from any wallet down to the secure screen of a hardware
device.

## The hook (open with this)

> Ledger's own XRP device app requires users to enable a **"Blind signing"**
> setting for newer transaction types. Even the hardware built to show you what
> you're signing can't render XRPL transactions. That setting existing is our
> project's reason to exist.

## The precedent (one breath)

> Ethereum answered blind signing with ERC-7730 after it cost the industry
> billions — Bybit alone was $1.5B (Feb 2025, the largest crypto theft ever),
> signed on hardware wallets that couldn't render intent. XRPL has no
> equivalent standard. We wrote it, with the reference parser, a risk-code
> vocabulary ERC-7730 doesn't even have, and it's running against a Ledger
> device right now.

Lineage if asked: EIP-712 (2017, structured messages only) → years of drainer
attacks → Ledger's Clear Signing Initiative + ERC-7730 (2024): JSON display
metadata per contract, reviewed into a public GitHub registry, consumed by the
device's secure screen. XRPL is the *easier* version of this problem — a fixed
set of transaction types instead of arbitrary calldata — and had nothing. Our
additions beyond a port: standardized risk annotations and Batch recursion
rules, which ERC-7730 doesn't define.

## Core pitch beats

1. **The hole:** every XRPL wallet hand-rolls its own transaction rendering —
   inconsistent, unaudited, software-only. No XRPL transaction has ever been
   clear-signed on a device's secure screen.
2. **The precedent:** EVM fixed this with ERC-7730 (metadata + registry).
   XRPL has a *fixed, known* transaction schema — the problem is strictly
   easier here, and nobody had done it.
3. **The scam demo:** a TrustSet named "RLUSD" pointing at a non-canonical
   issuer, with an effectively-unlimited limit — our registry flags
   `CURRENCY_IMPERSONATION` + `UNVERIFIED_ISSUER` + `UNLIMITED_TRUSTLINE`
   before you sign. Standardized risk codes, not per-wallet heuristics.
4. **Batch (XLS-56) is the newest blind-signing hole:** one approval executes
   up to 8 hidden inner transactions. We unfold every inner transaction through
   the same pipeline and bubble its warnings. A signer must never render a
   Batch as one opaque item — that rule is *in the spec*.
5. **Live, not just static:** XLS-69 `simulate` dry runs enrich the preview
   with projected balance changes from current ledger state ("you'll actually
   receive 1,248.3 RLUSD, crossing 3 offers"). Static rendering still works
   offline — devices need that.
6. **It ships Monday:** a TypeScript library + JSON metadata registry any
   wallet (Xaman, Crossmark, Ledger Wallet) can adopt. New transaction types
   (MPT, Credentials, XLS-65 Vaults, XLS-66 Lending) = one metadata file each,
   zero wallet code changes.
7. **Built where the ecosystem is going:** integrated Ledger's
   `device-signer-kit-xrp` **days after its pre-release**, running end-to-end
   (preview → device signature → settled testnet transaction), with DX
   feedback filed upstream as we went (FEEDBACK.md).

## Judge-specific lines

- **Track judges (Protocol Innovation):** "This is a standards contribution —
  draft spec posted to XRPL-Standards Discussions — plus the reference
  implementation and registry. Infrastructure every wallet shares."
- **Ledger:** "Your brief said rough prototype filling a real gap beats a
  polished rebuild. We extended Clear Signing beyond EVM, on your pre-release
  XRP signer kit, and filed what broke."
- **QuickNode:** "Previews are enriched by `simulate` and account lookups
  through QuickNode RPC, and the demo's live transaction feed rides your WSS.
  Infra isn't a logo here; it's what makes the preview stateful."

## Judging-criteria mapping (25/25/25/25)

- **Idea:** names a real, universal security hole; first XRPL display standard.
- **Implementation:** working library + registry + device signing end-to-end.
- **Demo:** scary-hex → plain-English → today's device screen vs. the
  clear-signing device profile, in one window.
- **Potential:** adoptable by every wallet Monday; extensible per XLS; registry
  governance modeled on ERC-7730's reviewed-repo precedent.

## Q&A ammo

- *"Xaman already shows readable transactions."* Per-wallet, proprietary,
  software-only. We're the portable standard underneath: shared metadata,
  shared risk codes, and rendering that reaches the hardware screen. Xaman
  adopting this = Xaman gets device-grade previews for free.
- *"Why not just simulate everything?"* Devices sign offline; simulation is
  enrichment, not the base layer. The spec mandates static rendering works
  with no connection.
- *"Who maintains the registry?"* Same model that works for ERC-7730: a
  reviewed public repo, wallets pin a hash. Draft spec section covers it.
- *"What existed before the event?"* Nothing — repo history starts Saturday
  night. The signer kit we integrate was pre-released by Ledger days ago.

## Demo script (90s)

1. Paste scam TrustSet **hex blob** → three red warnings, impersonation called
   out by name.
2. One click: legit RLUSD TrustSet → clean, verified ✓.
3. **Simulate** → projected balance changes from the live ledger.
4. Load the Batch → "1 signature, 2 hidden transactions" unfolds with inner
   warnings.
5. Sign it on the Ledger — the button is locked until you acknowledge the
   danger warnings. Side by side: today's Ledger screen (raw fields, scam and
   real look the same) vs. the clear-signing device profile (⚠ impersonation
   first, "Reject recommended" last), in the same browser window. Close: "Every wallet on XRPL can have this Monday."
