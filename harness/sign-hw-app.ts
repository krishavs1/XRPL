/**
 * Ledger signing harness — works against Speculos (emulator) or can be adapted
 * to a physical device via @ledgerhq/hw-transport-node-hid.
 *
 * Flow: derive pubkey from device → render Clear Signing preview in the
 * terminal → encode tx → sign on device → print submit-ready blob.
 *
 * Run Speculos first (see harness/README.md), then:
 *   npx tsx harness/sign-hw-app.ts
 */
import SpeculosHttpTransport from "@ledgerhq/hw-transport-node-speculos-http";
import Xrp from "@ledgerhq/hw-app-xrp";
import { encode } from "xrpl";
import { explain } from "xrpl-clear-signing";

const DERIVATION_PATH = "44'/144'/0'/0/0";
const SPECULOS_URL = process.env.SPECULOS_URL ?? "http://127.0.0.1:5000";

async function main() {
  console.log(`Connecting to Speculos at ${SPECULOS_URL} …`);
  const transport = await (SpeculosHttpTransport as any).open({ baseURL: SPECULOS_URL });
  const xrp = new (Xrp as any)(transport);

  const { address, publicKey } = await xrp.getAddress(DERIVATION_PATH);
  console.log(`Device address: ${address}`);

  // Demo transaction — swap in anything; explain() shows what we're signing.
  const tx: Record<string, any> = {
    TransactionType: "Payment",
    Account: address,
    Destination: "rrrrrrrrrrrrrrrrrrrrBZbvji",
    Amount: "1000000", // 1 XRP
    Fee: "12",
    Sequence: 1, // TODO: autofill from network (account_info via QuickNode)
    SigningPubKey: publicKey.toUpperCase(),
  };

  const intent = explain(tx);
  console.log(`\n=== Clear Signing preview ===\n${intent.title}: ${intent.summary}`);
  for (const f of intent.fields) console.log(`  ${f.label}: ${f.value}`);
  for (const w of intent.warnings) console.log(`  [${w.severity.toUpperCase()}] ${w.message}`);

  const unsignedHex = encode(tx);
  console.log("\nSending to device for signature (approve on the device screen)…");
  const signature: string = await xrp.signTransaction(DERIVATION_PATH, unsignedHex);

  tx.TxnSignature = signature.toUpperCase();
  const signedBlob = encode(tx);
  console.log(`\nSubmit-ready blob:\n${signedBlob}`);
  console.log("\nSubmit with: POST {method:'submit', params:[{tx_blob}]} to your QuickNode/testnet RPC");

  await transport.close();
}

main().catch((e) => {
  console.error("Harness failed:", e.message ?? e);
  console.error("Is Speculos running with the XRP app? See harness/README.md");
  process.exit(1);
});
