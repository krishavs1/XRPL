# Firmware proof of concept: the warning on the real device

`clear-signing-warning.patch` modifies the official Ledger XRP app
([LedgerHQ/app-xrp](https://github.com/LedgerHQ/app-xrp) @ `a7efd903`, v2.8.1)
so the device itself surfaces clear-signing risk warnings, inserted as the
first screen of the native review - on the device's own secure screen, not in
companion software. Three rules, matching the standard's headline risks:

- **TrustSet** whose issuer's 20-byte account ID is not in a baked-in verified
  set → unverified-issuer / impersonation warning;
- **AccountDelete** → the account and everything it holds goes to the
  destination, irreversibly;
- **SetRegularKey** → signing control is handed to another key (account
  takeover when the key isn't yours).

This is the firmware half of the standard: the web demo's "device profile"
panel shows what full metadata-driven rendering looks like; this patch proves
the same warning class runs inside the real app. Demoed on Speculos (Ledger's
emulator running the real app binary), since distributing modified firmware to
physical devices requires Ledger's review and signature - which is exactly why
the proposal is a metadata standard rather than a fork.

## Build & run

```sh
git clone https://github.com/LedgerHQ/app-xrp && cd app-xrp
git checkout a7efd903001bb41fd8df242a428bcf3abc07a72f
git apply ../firmware/clear-signing-warning.patch
docker run --rm -v "$PWD:/app" -w /app \
  ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest \
  bash -c 'make -j BOLOS_SDK="$STAX_SDK"'
# copy build/stax/bin/app.elf over vendor/ledger-workshop/xrpl-hackathon/speculos/apps/stax/app.elf
# and restart the emulator (run-speculos.sh stax)
```

## Implementation notes

- Detection compares the issuer's **raw 20-byte account ID** (`memcmp`) against
  the verified set - no base58 encoding or hashing at review time. (A first
  version re-encoded the issuer to base58 inside the review entrypoint and
  segfaulted; keep heavy crypto out of that call path.)
- The warning is injected as the first tag/value pair of the NBGL review, so it
  pages exactly like a native review screen.
- The verified set is baked in for the demo. The real design is the registry
  from `spec/transaction-display-metadata.md`: reviewed metadata, pinned by
  hash, consumed by the app - the ERC-7730 model.
- `harness/verify-firmware.ts` exercises it end to end: sends a scam TrustSet
  via the pre-release `device-signer-kit-xrp` and reads the warning text back
  off the emulator's screen.
