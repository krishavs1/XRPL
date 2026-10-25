/**
 * END-TO-END Ledger bounty flow using the PRE-RELEASE device-signer-kit-xrp
 * (the kit the bounty brief asks for) against Speculos:
 *
 *   Clear Signing preview → device signature → submitted testnet transaction.
 *
 * 1. Start the emulator:  cd vendor/ledger-workshop/xrpl-hackathon/speculos && ./run-speculos.sh stax
 * 2. Run:                 npx tsx harness/sign-dmk.ts
 * 3. Approve on the Speculos screen (web: http://127.0.0.1:5000, or the VNC viewer).
 *
 * Every rough edge in the kit goes in FEEDBACK.md + an issue on LedgerHQ/device-sdk-ts.
 */
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceModelId,
  bufferToHexaString,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { firstValueFrom } from "rxjs";
import { Client, Wallet, encode, type Payment } from "xrpl";
import { explain } from "xrpl-clear-signing";

const SPECULOS_URL = process.env.SPECULOS_URL ?? "http://127.0.0.1:5000";
const TESTNET_WSS = process.env.XRPL_WSS ?? "wss://s.altnet.rippletest.net:51233";
const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";
const PATH = "44'/144'/0'/0/0";

/** DMK device actions return { observable, cancel } - resolve on completion. */
function waitFor<T>(action: { observable: { subscribe: Function } }): Promise<T> {
  return new Promise((resolve, reject) => {
    action.observable.subscribe({
      next: (state: any) => {
        const interaction = state?.intermediateValue?.requiredUserInteraction;
        if (interaction && interaction !== "none") {
          console.log(`  [device] waiting for user: ${interaction}`);
        }
        if (state.status === DeviceActionStatus.Completed) resolve(state.output as T);
        else if (state.status === DeviceActionStatus.Error) reject(state.error ?? new Error("device action failed"));
      },
      error: reject,
    });
  });
}

async function main() {
  // Fast precheck so a missing emulator fails in 1s, not a hung discovery.
  try {
    const ping = await fetch(SPECULOS_URL, { signal: AbortSignal.timeout(1500) });
    if (ping.status === 403) {
      console.error(`Got 403 from ${SPECULOS_URL} - that's macOS AirPlay Receiver squatting on port 5000, not Speculos.`);
      console.error("Fix: System Settings → General → AirDrop & Handoff → turn OFF AirPlay Receiver, then start Speculos.");
      process.exit(1);
    }
  } catch {
    console.error(`Speculos not reachable at ${SPECULOS_URL}.`);
    console.error("Start it: cd vendor/ledger-workshop/xrpl-hackathon/speculos && ./run-speculos.sh stax");
    process.exit(1);
  }

  console.log("Building DMK with the Speculos transport…");
  const dmk = new DeviceManagementKitBuilder()
    .addTransport(speculosTransportFactory(SPECULOS_URL, false, DeviceModelId.STAX))
    .build();

  const device = await firstValueFrom(dmk.startDiscovering({ transport: speculosIdentifier }));
  const sessionId = await dmk.connect({ device });
  const signer = new SignerXrpBuilder({ dmk, sessionId }).build();

  console.log("Getting address from device…");
  const { address, publicKey } = await waitFor<{ address: string; publicKey: string }>(
    signer.getAddress(PATH, { checkOnDevice: false })
  );
  console.log(`Device address: ${address}`);

  const client = new Client(TESTNET_WSS);
  await client.connect();

  // Fund from the faucet on first run.
  let balance: number | null = null;
  try {
    balance = await client.getXrpBalance(address);
  } catch (e: any) {
    if (e?.data?.error !== "actNotFound") throw e;
  }
  if (balance === null) {
    console.log("Account not funded - asking the testnet faucet…");
    const res = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: address }),
    });
    if (!res.ok) throw new Error(`Faucet failed: ${res.status}`);
    for (let i = 0; i < 20 && balance === null; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        balance = await client.getXrpBalance(address);
      } catch {}
    }
    if (balance === null) throw new Error("Faucet funding did not land");
  }
  console.log(`Balance: ${balance} XRP`);

  // Build the payment. autofill sets Fee/Sequence; give 10 min to sign.
  const tx = await client.autofill<Payment>({
    TransactionType: "Payment",
    Account: address,
    Destination: Wallet.generate().classicAddress,
    Amount: "1000000", // 1 XRP
    SigningPubKey: publicKey.toUpperCase(),
    LastLedgerSequence: (await client.getLedgerIndex()) + 150,
  } as Payment);

  // === The point of this project: show what you're signing, first. ===
  const intent = explain(tx as unknown as Record<string, unknown>);
  console.log(`\n=== Clear Signing preview ===\n${intent.title}: ${intent.summary}`);
  for (const f of intent.fields) console.log(`  ${f.label}: ${f.value}`);
  for (const w of intent.warnings) console.log(`  [${w.severity.toUpperCase()}] ${w.message}`);

  // encode(), NOT encodeForSigning(): the XRP device app adds the prefix itself.
  const unsignedHex = encode(tx);
  console.log("\nSign on the device (tap through, then hold to sign)…");
  const signature = await waitFor<Uint8Array>(
    signer.signTransaction(PATH, hexaStringToBuffer(unsignedHex)!)
  );

  const signedHex = encode({
    ...tx,
    TxnSignature: bufferToHexaString(signature, false).toUpperCase(),
  });

  console.log("Submitting to testnet…");
  const res = await client.submitAndWait(signedHex);
  const meta = res.result.meta;
  const result = typeof meta === "object" && meta ? (meta as any).TransactionResult : "unknown";
  console.log(`\nResult: ${result}`);
  console.log(`Explorer: https://testnet.xrpl.org/transactions/${res.result.hash}`);

  await client.disconnect();
  process.exit(result === "tesSUCCESS" ? 0 : 2);
}

main().catch((e) => {
  console.error("Harness failed:", e?.message ?? e);
  process.exit(1);
});
