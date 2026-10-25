# Ledger DX feedback - Clear team

> Ledger judges documentation feedback as much as code. Log everything here as
> it happens; file the concrete ones as issues/PRs on LedgerHQ repos and link
> them back.

## device-signer-kit-xrp (pre-release) + Speculos transport

| What happened | Expected | Where | Issue/PR link |
| --- | --- | --- | --- |
| Concurrent APDU access (two DMK clients, or a client + another tab) fails with the opaque message "Unexpected device exchange error happened" - no hint that contention is the cause. Cost ~2h of debugging. | A typed, specific error (e.g. `DeviceBusyError` / "another session holds the device"), or serialized access. | `@ledgerhq/device-transport-kit-speculos` exchange path | _to file_ |
| After a `signTransaction` times out or errors, the device app is left stranded mid-review; the existing session then silently accepts new sign requests that never reach the device. Only rebuilding the whole kit (`new DeviceManagementKitBuilder()`) recovers - there is no session reset / cancel-and-reset API surfaced. | A `signer`/session-level reset that returns the device app to its home screen and re-synchronizes. | DMK session lifecycle | _to file_ |
| `signTransaction` review has a short, undocumented idle timeout; an unhurried human review on a touch model trips it, then surfaces as the same generic "Unexpected device exchange error". | Documented timeout + a distinct `UserInteractionTimeout` error. | signer-kit `signTransaction` | _to file_ |
| Docs don't state that the Speculos HTTP API serves a single APDU exchange at a time; nothing warns against running the Node harness and a browser DMK session against the same emulator. | A note in the Speculos transport docs. | docs: device-transport-kit-speculos | _to file_ |

## Docs gaps & confusing flows

- 

## Tutorial ideas

- An end-to-end "sign an XRPL TrustSet on Speculos" tutorial (we had to assemble
  it from three doc pages - see harness/README.md).

## Time-savers we wished existed

- 
