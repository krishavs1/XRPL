# Draft: Transaction Display Metadata for the XRP Ledger

**Status:** Draft for discussion (written at the AI & Fintech XRPL Hackathon, NYC, Oct 2026)
**Reference implementation:** `xrpl-clear-signing` (this repository)
**Prior art:** ERC-7730 (Ledger's Clear Signing metadata standard for EVM calldata)

## Abstract

A portable JSON metadata format that lets any XRPL wallet — software or
hardware — render a transaction as human-readable intent with standardized risk
annotations, instead of raw fields or hex. One registry, every wallet, down to
the secure screen of a signing device.

## Motivation

Every XRPL wallet today hand-rolls its own transaction rendering. The results
are inconsistent, unaudited, and stop at the software layer: no XRPL
transaction type has ever been "clear signed" on a hardware device's secure
screen. Users approve TrustSet, OfferCreate, AMMDeposit, EscrowCreate and —
since XLS-56 — entire *Batches* of transactions they cannot read.

EVM solved this with ERC-7730: metadata that maps calldata to display intent,
reviewed and distributed through a registry. XRPL has no equivalent, despite
having a *fixed, known* transaction schema that makes the problem strictly
easier than EVM's arbitrary calldata.

## Specification

### Display metadata document

One JSON document per transaction type:

```json
{
  "version": "0.1",
  "txType": "TrustSet",
  "title": "Set trustline",
  "intent": "Trust up to {LimitAmount.value} {LimitAmount.currency|currency} issued by {LimitAmount.issuer|account}.",
  "flags": { "tfSetNoRipple": 131072, "tfSetFreeze": 1048576 },
  "fields": [
    { "path": "LimitAmount.currency", "label": "Currency", "format": "currency" },
    { "path": "LimitAmount.issuer",   "label": "Issuer",   "format": "account", "risks": ["UNVERIFIED_ISSUER"] },
    { "path": "LimitAmount.value",    "label": "Limit",    "format": "decimal", "risks": ["UNLIMITED_TRUSTLINE"] },
    { "path": "Flags",                "label": "Flags",    "format": "flags",   "hideIfEmpty": true }
  ],
  "risks": [
    { "code": "UNVERIFIED_ISSUER", "severity": "danger",
      "when": { "not": { "verified": "LimitAmount.issuer" } },
      "message": "Issuer {LimitAmount.issuer|address} is not in the verified registry." },
    { "code": "CURRENCY_IMPERSONATION", "severity": "danger",
      "when": { "impersonates": { "currency": "LimitAmount.currency", "issuer": "LimitAmount.issuer" } },
      "message": "\"{LimitAmount.currency|currency}\" is canonically issued by {LimitAmount.currency|canonicalIssuers}, but this trustline points at a different account." },
    { "code": "UNLIMITED_TRUSTLINE", "severity": "danger",
      "when": { "gte": ["LimitAmount.value", 1000000000] },
      "short": "effectively unlimited",
      "message": "Trustline limit is effectively unlimited: you accept any amount of this token." }
  ]
}
```

The complete document is `packages/core/metadata/TrustSet.json` in the
reference implementation, which renders TrustSet from it with no
type-specific code.

- **Paths** are dotted field paths into the transaction JSON
  (`LimitAmount.issuer`).
- **Templates** (`intent`, `message`) substitute `{path}` or `{path|format}`.
- **`flags`** maps flag names to bits for the `flags` format and the `flag`
  condition.
- **Field `risks`** link a field to risk codes: when one fires, the field is
  marked with its severity and the risk's `short` note is appended to the value.
- **`hideIfEmpty`** omits a field whose formatted value is empty.

### Risk conditions

`when` is a structured JSON condition, not an expression string: there is
nothing to parse or `eval`, and a signing device can implement it in a few
dozen lines. Each condition object has exactly one operator key:

| Condition | True when |
|---|---|
| `{ "not": C }`, `{ "and": [C…] }`, `{ "or": [C…] }` | boolean composition |
| `{ "gte": [path, n] }` | the field is numeric and ≥ `n` |
| `{ "flag": name }` | the named bit (from `flags`) is set in `Flags` |
| `{ "missing": path }` | the field is absent |
| `{ "verified": path }` | the account at `path` is verified in the registry |
| `{ "impersonates": { "currency": path, "issuer": path } }` | the currency name has verified canonical issuer(s) in the registry and the issuer is none of them |
| `{ "requiresTag": path }` | the registry marks the account as requiring a destination tag |

Implementations MUST reject a document with an unknown operator, format, or
field-risk reference at load time rather than skip the rule while signing.

### Formats

`currency` (160-bit code → name, with AMM-LP detection), `account` (registry
name + verified mark + truncated address), `amount` (drops → XRP; issued
amounts with issuer attribution), `rippleTime` (epoch 946684800 → ISO-8601),
`decimal`, `flags` (named bits), `address` (truncated address, no registry
lookup), `canonicalIssuers` (a currency's verified issuers, for messages),
`raw`.

### Account registry

A signed JSON registry maps addresses to `{name, verified, kind, currencies,
requiresDestinationTag}`. The `currencies` field enables **impersonation
detection**: a currency name whose canonical verified issuer differs from the
transaction's issuer is flagged. Registries are per-network (mainnet/testnet)
and distributable like ERC-7730's registry (reviewed repo; wallets pin a hash).

### Risk annotations

Risk codes are part of the standard, not the wallet, so every wallet warns on
the same facts: `UNLIMITED_TRUSTLINE`, `UNVERIFIED_ISSUER`,
`CURRENCY_IMPERSONATION`, `PARTIAL_PAYMENT`, `MISSING_DESTINATION_TAG`,
`BATCH_MULTI_EXECUTION`, `NO_DISPLAY_METADATA`. Severities: `info | warn |
danger`.

### Composition (Batch, XLS-56)

A Batch transaction's `RawTransactions` are rendered recursively through the
same pipeline; inner warnings bubble to the top-level intent. A signer MUST NOT
render a Batch as a single opaque item.

### Simulation enrichment (XLS-69)

Where a connection is available, a renderer SHOULD enrich static intent with a
`simulate` dry run (rippled ≥ 2.4.0): projected balance changes, offer
crossings, and the engine result. Static rendering MUST remain fully functional
offline (hardware devices).

### Fallback

Unknown types/fields render raw with `NO_DISPLAY_METADATA`. Nothing is hidden.

### Device profile

Secure-screen constraints: fields render in metadata order; `danger` risks
render before fields; strings truncate middle-out; registry names render only
with the verified mark.

## Extensibility

New transaction types (MPT XLS-33, Credentials, Vault XLS-65, Lending XLS-66)
add one metadata document each — no wallet code changes.

## Open questions

- Registry governance: who reviews entries? (ERC-7730 precedent: PR review in a
  public repo + wallet-side pinning.)
- Field paths: dotted paths cover today's schema; array indexing (e.g.
  `Memos[0]`) is not yet specified.
- Localization of `title`/`intent` templates.
