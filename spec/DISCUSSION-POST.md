# Post this to github.com/XRPLF/XRPL-Standards → Discussions → New discussion (category: Standards / Pre-proposal)

Suggested title: **Pre-proposal: Transaction Display Metadata (clear signing for XRPL)**

---

## Abstract

A JSON metadata format that lets any XRPL wallet — software or hardware —
render a transaction as human-readable intent with standardized risk
annotations, instead of raw fields or a signing blob. Comparable in role to
ERC-7730 on EVM, adapted to XRPL's fixed transaction schema.

## Motivation

Every XRPL wallet implements its own transaction rendering. The results are
inconsistent, unaudited, and software-only: no XRPL transaction type renders
as intent on a hardware device's secure screen, and newer transaction types
fall back to blind signing. Concretely, today a user cannot tell from any
signing UI that:

- a TrustSet named "RLUSD" points at a non-canonical issuer with an
  effectively unlimited limit;
- a Payment carries `tfPartialPayment`, so the stated Amount is not what will
  arrive;
- a Batch (XLS-56) executes up to 8 inner transactions behind one approval;
- an AMMDeposit is single-sided with no `LPTokenOut`/`EPrice` bound.

EVM addressed the equivalent problem with ERC-7730: reviewed display metadata
consumed by wallets and devices. XRPL's case is simpler — a closed set of
transaction types with known schemas rather than arbitrary calldata — and has
no equivalent standard.

## Specification (summary — full draft linked below)

1. **Display metadata document, one per transaction type**: a title, an
   intent template, an ordered field list (`path`, `label`, `format`), and
   declarative risk rules. Formats: `currency` (160-bit code decoding, AMM-LP
   detection), `account`, `amount`, `rippleTime`, `decimal`, `flags`.
2. **Account registry**: per-network signed JSON mapping addresses to
   `{name, verified, kind, currencies, requiresDestinationTag}`. The
   `currencies` field enables impersonation detection: a currency name whose
   canonical verified issuer(s) do not include the transaction's issuer is
   flagged.
3. **Standardized risk codes** with severities (`info|warn|danger`), so every
   conforming wallet warns on the same facts: `UNLIMITED_TRUSTLINE`,
   `UNVERIFIED_ISSUER`, `CURRENCY_IMPERSONATION`, `PARTIAL_PAYMENT`,
   `MALFORMED_PARTIAL_XRP`, `MISSING_DESTINATION_TAG`,
   `BATCH_MULTI_EXECUTION`, `SINGLE_SIDED_DEPOSIT`, `POOL_SEEDING`,
   `NO_DISPLAY_METADATA`, among others.
4. **Composition rule**: a Batch's `RawTransactions` MUST be rendered
   recursively through the same pipeline, inner warnings surfaced at the top
   level; a conforming signer MUST NOT render a Batch as one opaque item.
5. **Enrichment rule**: where connectivity exists, renderers SHOULD enrich
   static intent with a `simulate` (XLS-69) dry run; static rendering MUST
   remain fully functional offline, since hardware devices sign offline.
6. **Fallback rule**: unknown types/fields render raw with
   `NO_DISPLAY_METADATA`; nothing is hidden.
7. **Device profile**: ordering, truncation, and warning-precedence rules for
   secure-screen rendering.

## Rationale

- Metadata, not code: wallets differ in stack; a declarative format is
  reviewable and portable, following the ERC-7730 precedent.
- Risk codes in the standard, not the wallet: warning semantics should not be
  a wallet differentiator; they should be audited once.
- Per-type documents: XRPL's amendment process adds transaction types at a
  known cadence; new types (MPT, Credentials, XLS-65 Vaults, XLS-66 Lending)
  are one metadata file each, with no wallet code changes.

## Security considerations

Registry governance is the main trust surface (same as ERC-7730): entries are
reviewed via PR in a public repository, and wallets pin a registry hash. The
renderer must be deterministic from (bytes, metadata, registry) so two wallets
cannot disagree about displayed intent. Simulation output is advisory
enrichment and must never substitute for static rendering.

## Reference implementation

Draft spec, a TypeScript reference parser covering six transaction types
(TrustSet, Payment, OfferCreate, EscrowCreate, AMMDeposit, Batch) with the
fallback renderer, a demo rendering previews beside a Ledger device via the
pre-release `device-signer-kit-xrp`, and fixture tests:
**[LINK TO YOUR GITHUB REPO]**

Built at the AI & Fintech XRPL Hackathon (NYC, Oct 24–25, 2026). Feedback
wanted on: the field-path expression subset, registry governance, and whether
risk codes belong in this standard or a companion document.
