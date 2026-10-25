# Ledger signing harness

Two paths to a device-signed XRPL transaction. **Do this first — it's the
highest-variance dependency and qualifies the Ledger bounty.**

## Path A: Speculos emulator (no hardware needed)

1. Get the XRP device app binary (`.elf`). Sources, in order of ease:
   - Ask at the **Ledger booth** — they have builds and the workshop repo.
   - Ledger's hackathon workshop repo (linked from https://developers.ledger.com/xrplnyc) ships Speculos setup.
   - Build from https://github.com/LedgerHQ/app-xrp (needs the Ledger build toolchain).

2. Run Speculos (Docker is simplest):

   ```sh
   docker run --rm -it -p 5000:5000 -v "$PWD:/apps" \
     ghcr.io/ledgerhq/speculos --model nanosp /apps/xrp.elf \
     --display headless --api-port 5000
   ```

3. Sign:

   ```sh
   npx tsx harness/sign-hw-app.ts
   ```

   Approve on the emulated screen at http://127.0.0.1:5000.

## Path B: the pre-release `device-signer-kit-xrp` (the bounty wants this)

Ledger's brief: "integrate it into a real app, find where it breaks, and extend
it. Bug reports and PRs count." Docs:
https://developers.ledger.com/docs/device-interaction/dmk-ts/references/signers/xrp

```sh
npm install @ledgerhq/device-signer-kit-xrp @ledgerhq/device-management-kit
```

Port `sign-hw-app.ts` to the DMK transport + XRP signer. **Every breakage goes
in FEEDBACK.md and as a GitHub issue on LedgerHQ/device-sdk-ts — that's judged
as much as the code.** Keep Path A as the working fallback for the demo.

## Physical device (booth, final demo)

Swap the transport for `@ledgerhq/hw-transport-node-hid` (Node) or
`@ledgerhq/hw-transport-webusb` (browser demo) — the Xrp app API is identical.

## Notes

- `signTransaction` takes the serialized tx hex **with SigningPubKey set**; the
  device returns a DER signature that goes into `TxnSignature`.
- Autofill `Sequence`/`Fee` from the network before encoding (account_info) —
  the harness currently hardcodes them for the offline Speculos flow.
