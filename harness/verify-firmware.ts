/**
 * Verifies the modified XRP app firmware renders the clear-signing warning:
 * sends a scam TrustSet to the device, then reads the Speculos screen text
 * and checks for the injected SECURITY WARNING review screen.
 * Resets nothing — restart the emulator after running (the pending review is abandoned).
 */
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceModelId,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { firstValueFrom } from "rxjs";
import { encode } from "xrpl";

const SPECULOS = "http://127.0.0.1:5000";
const PATH = "44'/144'/0'/0/0";
const RLUSD_HEX = "524C555344" + "0".repeat(30);
const SCAM_ISSUER = "rapcCizU9u5EeaNT8rrzXESwbJcj5VUuKn";

async function screenText(): Promise<string> {
  const res = await fetch(`${SPECULOS}/events?stream=false`);
  const d: any = await res.json();
  return (d.events ?? []).map((e: any) => e.text).join(" | ");
}

async function main() {
  const dmk = new DeviceManagementKitBuilder()
    .addTransport(speculosTransportFactory(SPECULOS, false, DeviceModelId.STAX))
    .build();
  const device = await firstValueFrom(dmk.startDiscovering({ transport: speculosIdentifier }));
  const sessionId = await dmk.connect({ device });
  const signer = new SignerXrpBuilder({ dmk, sessionId }).build();

  const addr = await new Promise<{ address: string; publicKey: string }>((resolve, reject) => {
    signer.getAddress(PATH, { checkOnDevice: false }).observable.subscribe({
      next: (s: any) => {
        if (s.status === DeviceActionStatus.Completed) resolve(s.output);
        else if (s.status === DeviceActionStatus.Error) reject(s.error ?? new Error("getAddress failed"));
      },
      error: reject,
    });
  });

  const tx = {
    TransactionType: "TrustSet",
    Account: addr.address,
    Flags: 131072,
    LimitAmount: { currency: RLUSD_HEX, issuer: SCAM_ISSUER, value: "1000000000" },
    Fee: "12",
    Sequence: 1,
    SigningPubKey: addr.publicKey.toUpperCase(),
  };

  console.log("Sending scam TrustSet to device (not approving)…");
  signer.signTransaction(PATH, hexaStringToBuffer(encode(tx as any))!); // fire, don't await

  await new Promise((r) => setTimeout(r, 5000));
  const text = await screenText();
  const hit = text.includes("SECURITY WARNING");
  console.log(`\nScreen contains SECURITY WARNING: ${hit ? "YES ✓" : "NO ✗"}`);
  const idx = text.indexOf("SECURITY WARNING");
  if (idx >= 0) console.log(`Context: …${text.slice(Math.max(0, idx - 60), idx + 160)}…`);
  process.exit(hit ? 0 : 2);
}

main().catch((e) => {
  console.error("verify failed:", e?.message ?? e);
  process.exit(1);
});
