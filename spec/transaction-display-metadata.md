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
type-specific code. The same directory holds documents for `SetRegularKey`,
`SignerListSet`, `AccountSet` and `AccountDelete`.

- **Paths** are dotted field paths into the transaction JSON
  (`LimitAmount.issuer`). A `*` segment maps over an array
  (`SignerEntries.*.SignerEntry.Account`); in a template or a non-account
  field the values are joined with ", ", and an `account` field renders one
  field per entry ("Signer 1", "Signer 2", …) so the device profile's
  verified-name rule applies to each account.
- **Templates** (`intent`, `message`) substitute `{path}` or `{path|format}`.
- **`intent`** is a template, or a list of variants
  `[{ "when": C, "text": "…" }, …, { "text": "…" }]`: the first variant whose
  condition holds is used, and the last one MUST have no `when`.
- **`flags`** maps flag names to bits for the `flags` format and the `flag`
  condition.
- **`enums`** maps named value tables (`{ "asf": { "4": "Disable master key" } }`)
  for the `enum:<name>` format, for fields holding a number rather than bits
  (AccountSet `SetFlag` / `ClearFlag`).
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
| `{ "eq": [path, v] }` | the field is present and equals `v` |
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
`decimal`, `flags` (named bits), `enum:<name>` (a value looked up in the
document's `enums`), `hexText` (hex-encoded ASCII such as `Domain` → text),
`address` (truncated address, no registry lookup), `canonicalIssuers` (a
currency's verified issuers, for messages), `raw`.

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

Account-control codes, for the transaction types an attacker uses to take
over or empty an account: `REGULAR_KEY_CHANGE` (danger), `REGULAR_KEY_REMOVED`
(info), `SIGNER_LIST_CHANGE` (danger), `SIGNER_LIST_REMOVED` (info),
`MASTER_KEY_DISABLED` (danger), `NFTOKEN_MINTER_SET` (warn),
`CLAWBACK_ENABLED` (warn), `ACCOUNT_DELETION` (danger),
`UNVERIFIED_DESTINATION` (warn). Handing signing power to another key is
`danger` even when the user means it: a device cannot tell the user's own key
from an attacker's, and the loss is total and irreversible.

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

The device profile maps a rendered intent to the ordered screens a signing
device shows. Its job is to make a dangerous transaction look different from a
safe one at the moment of approval:

1. `danger` risks render first, before the title and any field.
2. Then the title, then fields in metadata order. Values longer than the
   screen truncate middle-out (keep the start and end, which users compare).
3. An account renders its registry name only if the entry is verified;
   otherwise it shows the truncated address marked "unverified". An
   unverified name is attacker-chosen text and MUST NOT be shown.
4. Batch inner transactions render as their own screen groups, after the
   outer fields.
5. `warn` and `info` risks render after the fields.
6. The final approval screen MUST differ when any `danger` risk fired
   (reference: "Reject recommended", vs. "Sign transaction?" otherwise).

Software wallets SHOULD likewise block one-click approval when a `danger` risk
fired, requiring an explicit acknowledgement of the risk codes.

Reference implementation: `toDeviceScreens()` in `packages/core/src/device.ts`.

## Extensibility

New transaction types (MPT XLS-33, Credentials, Vault XLS-65, Lending XLS-66)
add one metadata document each — no wallet code changes.

## Open questions

- Registry governance: who reviews entries? (ERC-7730 precedent: PR review in a
  public repo + wallet-side pinning.)
- Field paths: `*` maps over arrays for display, but conditions over arrays
  (e.g. "any signer is unverified") and indexing (`Memos[0]`) are not yet
  specified.
- Localization of `title`/`intent` templates.
