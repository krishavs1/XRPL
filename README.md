# Clear

**Stop blind-signing on the XRP Ledger.** A display-metadata standard
(ERC-7730-style, for XRPL) and a reference parser that turn any XRPL
transaction, JSON or a raw signing blob, into human-readable, risk-annotated
intent. Enriched with live `simulate` dry runs (XLS-69) over a QuickNode
endpoint, and rendered from the wallet down to a Ledger device's secure screen.

Built at the AI & Fintech XRP Ledger Hackathon, NYC (October 2026).

## The problem

When you sign a transaction on XRPL you are approving data you cannot read, raw
hex or cryptic field names. Every wallet renders transactions its own way, and
on a hardware device most of that falls apart into raw fields or blind signing.
Nothing warns you that a TrustSet names a token after a real asset but points at
a scam issuer, that a SetRegularKey hands your signing keys to an attacker, that
a Payment's stated amount is not what will arrive, or that one Batch signature
hides several transactions.

Ethereum answered this with ERC-7730, display metadata reviewed into a registry
and consumed by wallets and Ledger devices so the secure screen shows
human-readable intent. XRPL had no equivalent, even though it is an easier
problem, a fixed and known set of transaction types instead of arbitrary
contract calldata. This is that standard.

## What this is

**A standard** (`spec/transaction-display-metadata.md`). A JSON display metadata
format, one document per transaction type, plus an account registry with
impersonation detection, standardized risk codes, Batch recursion rules, and a
device rendering profile.

**A reference parser** (`packages/core`, published as `xrpl-clear`).
`explain(blobOrJson)` returns a structured, risk-annotated `DisplayIntent`. Nine
transaction types render entirely from JSON metadata documents (TrustSet,
Payment, OfferCreate, EscrowCreate, AMMDeposit, SetRegularKey, SignerListSet,
AccountSet, AccountDelete). Batch is the one hand-written renderer, because the
spec defines it as a composition rule that recurses inner transactions. Unknown
types fall back to a safe raw render. The parser is an interpreter for the
standard, so adding a type is a JSON file rather than code.

**A web tool** (`apps/demo`). Paste hex or JSON, pick a scenario, or pull a live
transaction off the ledger. See the decoded intent and risk warnings, run an
XLS-69 `simulate` dry run, stream validated transactions in real time, and sign
on a Ledger (Speculos emulator or a real device). Every live call runs on a
QuickNode XRPL endpoint.

**A firmware proof of concept** (`firmware/`). A fork of
[LedgerHQ/app-xrp](https://github.com/LedgerHQ/app-xrp) that renders the warning
on the device's own secure screen, proving the rendering belongs on hardware.
Demoed on Speculos, since shipping to physical devices requires Ledger's review
and signature.

## How it works

The heavy, data-dependent work runs on the host, and the device only has to be
trusted. The host resolves the display metadata and the account registry, runs
the live `simulate` check through a node (QuickNode), and produces the preview.
In the full architecture the device then verifies a signed descriptor and
renders it on the secure screen, which is exactly how Ledger's ERC-7730 flow
works on Ethereum. The Secure Element has no network, no filesystem, and
kilobytes of RAM, so the registry and the interpreter are host-side by design,
and only verify-and-render belongs on the device.

## The live layer runs on QuickNode

The parser reads transaction bytes offline, but everything that knows what is
true on the ledger right now runs on a single QuickNode XRPL endpoint. QuickNode
is the project's eyes on the live ledger, and it is what turns a static decode
into a stateful preview, not just what a transaction says but what it would
actually do. Through one QuickNode endpoint the app runs `simulate` (XLS-69) dry
runs against current ledger state, autofills fee and sequence and ledger index
before signing, submits transactions, reads account balances and state, and
powers the real-time feed, a WebSocket `subscribe` to every validated
transaction on the network streamed straight through the decoder.

The `simulate` dry run is the core of the demo, where the ledger accepts a scam
as valid and only the standard catches it. Set the endpoint with `VITE_XRPL_WSS`
in `apps/demo/.env.local`. The device itself never connects to the node, because
it has no network, so all live ledger access happens on the host through
QuickNode.

## What is live and what is static

The account registry (`packages/core/registry/issuers.json`) is a curated JSON
file. Issuer names and the verified marks come from it rather than the ledger,
and the UI shows "unknown account" for anything not in it. Everything else is
live on a QuickNode endpoint, the `simulate` dry runs, balances, submission, and
the real-time feed. It all runs on testnet, with throwaway testnet issuer
accounts in the demo fixtures.

## Quickstart

```sh
npm install
npm test        # run the core library tests
npm run demo    # serve the web demo
```

The demo serves at http://localhost:5173. Point it at your own node by setting
`VITE_XRPL_WSS` in `apps/demo/.env.local`, otherwise it falls back to the public
testnet endpoint. For the Ledger flow, start the Speculos emulator, then use the
"sign on device" button in the demo or run `npx tsx harness/sign-dmk.ts`. To
render the firmware warning on the device yourself, apply
`firmware/clear-signing-warning.patch` to `LedgerHQ/app-xrp` and build it.

Speculos serves one client at a time. Do not run the harness and the browser
demo (or two browser tabs) against it at once, since a concurrent exchange
surfaces as a generic "Unexpected device exchange error". Use one client, and
reload the tab after any device error.

## Demo

Load the Account takeover scenario. The preview flags it in red, because it
hands an unknown key permanent signing control of the account. Hit simulate, and
the ledger returns `tesSUCCESS`, a perfectly valid transaction. The ledger will
not stop you, and the device will not either. Only the standard catches it.

Compare the two devices. Today's Ledger XRP app shows raw fields. The
clear-signing device profile leads with the warning and ends with "Reject
recommended", and the sign button stays locked until the danger warnings are
acknowledged.

Try a Batch off the live feed. One signature, its inner transactions unfolded,
each risk-checked and its warnings bubbled up.

## Repository layout

```
spec            the display-metadata standard
packages/core   the xrpl-clear library (parser, metadata interpreter, registry, simulate, device profile)
apps/demo       the web tool
harness         standalone Ledger signing scripts
firmware        the app-xrp fork that renders the warning on real firmware
```
