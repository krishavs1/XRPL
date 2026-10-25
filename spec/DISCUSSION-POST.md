# Post this to github.com/XRPLF/XRPL-Standards → Discussions → New discussion (category: Standards / Pre-proposal)

Suggested title: **Pre-proposal: a display-metadata standard for clear signing on XRPL**

---

## The gap

Every XRPL wallet renders transactions its own way, and when you get down to a
hardware device, most of that rendering falls apart. The device shows raw
fields at best, and for newer transaction types it asks you to turn on blind
signing and approve bytes you can't read. There's no shared, auditable way to
say "this is what this transaction does, and here's why it might be dangerous."

A few concrete things that no signing UI I've seen will warn you about today:

- a TrustSet to a token named "RLUSD" whose issuer isn't the real RLUSD issuer
  (a scam token impersonating a real one), with an effectively unlimited limit;
- a Payment with `tfPartialPayment` set, where the Amount you see is not what
  actually arrives;
- a Batch (XLS-56) that runs up to 8 inner transactions behind a single
  approval;
- a SetRegularKey that quietly hands signing control of your account to another
  key.

Ethereum ran into this and ended up with ERC-7730: display metadata, reviewed
into a registry, consumed by wallets and by Ledger devices so the secure screen
can show human-readable intent. XRPL has nothing equivalent, even though our
problem is actually easier — we have a fixed, known set of transaction types
instead of arbitrary contract calldata.

So we took a run at it over the weekend and want to float the design here before
it hardens into anything.

## What we're proposing

A JSON display-metadata format, one document per transaction type, plus a small
registry of known accounts. A wallet that adopts it writes JSON, not code.

Each **metadata document** carries a title, an intent template, an ordered list
of fields to show (with a `format` each — `amount`, `account`, `currency`,
`rippleTime`, `flags`, and so on), and a set of **risk rules**. A risk rule is
a declarative condition plus a message; the ones whose conditions hold become
warnings. The conditions are deliberately boring — `gte`, `flag`, `missing`,
`verified`, `impersonates`, combined with `and`/`or`/`not` — so the rules stay
auditable and portable rather than turning into per-wallet code.

The **account registry** is a per-network JSON file mapping addresses to
`{ name, verified, currencies, ... }`. It's what makes impersonation detection
possible: decode a transaction's currency to a name, ask the registry who the
verified issuer(s) of that name are, and if the transaction's issuer isn't one
of them, flag it.

A few rules we think belong in the standard, not left to each wallet:

- **Standardized risk codes.** Warning semantics shouldn't be a wallet
  differentiator. `CURRENCY_IMPERSONATION`, `UNLIMITED_TRUSTLINE`,
  `PARTIAL_PAYMENT`, `BATCH_MULTI_EXECUTION`, `SINGLE_SIDED_DEPOSIT`, etc., each
  with a severity (`info`/`warn`/`danger`), so every conforming wallet warns on
  the same facts.
- **Batch is composition, not a type.** A Batch's inner transactions MUST be
  rendered recursively through the same pipeline, with their warnings surfaced
  at the top level. A signer MUST NOT show a Batch as one opaque item.
- **Simulation is enrichment, never the floor.** Where there's a connection, a
  renderer SHOULD enrich the static preview with a `simulate` (XLS-69) dry run.
  But static rendering MUST work fully offline, because devices sign offline.
- **Nothing hides.** Unknown types or fields render raw with a
  `NO_DISPLAY_METADATA` warning rather than silently disappearing.
- **A device profile** for ordering, truncation, and warning precedence on a
  secure screen (dangers before fields, middle-truncated addresses, verified
  names only when the registry says so).

## What we actually built

Not just a doc — we wanted to know the format could carry real logic:

- A reference parser in TypeScript. **Nine transaction types render entirely
  from metadata documents** (TrustSet, Payment, OfferCreate, EscrowCreate,
  AMMDeposit, SetRegularKey, SignerListSet, AccountSet, AccountDelete); Batch is
  the one hand-written renderer, because it's the composition rule above rather
  than a per-type document. No rendering code per type — the parser is an
  interpreter for the format.
- A demo that previews any transaction (JSON or a raw signing blob), enriches it
  with `simulate`, and signs on a Ledger via the pre-release
  `device-signer-kit-xrp`, with the device's screen shown beside the preview.
- A proof that this belongs on the device: we forked the XRP app firmware
  (LedgerHQ/app-xrp) so the unverified-issuer / impersonation warning renders on
  the device's own review screen. It runs on Speculos; shipping to real devices
  is Ledger's to do, which is exactly the point of proposing a standard rather
  than a fork.

Repo (spec, parser, tests, demo, firmware patch):
**https://github.com/krishavs1/XRPL**

## Open questions we'd genuinely like input on

- **Registry governance.** We've assumed the ERC-7730 model — entries reviewed
  by PR in a public repo, wallets pin a hash. Is that the right home for XRPL,
  or should issuer verification hang off something more native?
- **How far the condition language should go.** We kept it to simple predicates
  on purpose. Computed values (an OfferCreate's effective price, say) and
  conditions over arrays don't fit yet. Grow the DSL, or keep an escape hatch
  for the hard cases?
- **Where risk codes live** — in this standard, or a companion document that can
  version independently of the display format?

Built at the AI & Fintech XRP Ledger Hackathon (NYC, Oct 24-25, 2026). Happy to
turn this into a proper XLS draft if there's appetite for it.
