import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceModelId,
  bufferToHexaString,
  hexaStringToBuffer,
  type DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { SignerXrpBuilder, type SignerXrp } from "@ledgerhq/device-signer-kit-xrp";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import {
  webHidIdentifier,
  webHidTransportFactory,
} from "@ledgerhq/device-transport-kit-web-hid";
import { firstValueFrom } from "rxjs";

export const SPECULOS_URL = "http://127.0.0.1:5000";
export const DERIVATION_PATH = "44'/144'/0'/0/0";
export type TransportChoice = "speculos" | "usb";

let dmk: DeviceManagementKit | undefined;

function getDmk(): DeviceManagementKit {
  if (!dmk) {
    dmk = new DeviceManagementKitBuilder()
      .addTransport(webHidTransportFactory) // real device over USB (Chrome/Edge/Brave)
      .addTransport(speculosTransportFactory(SPECULOS_URL, false, DeviceModelId.STAX))
      .build();
  }
  return dmk;
}

export async function connectDevice(transport: TransportChoice): Promise<SignerXrp> {
  const kit = getDmk();
  const device = await firstValueFrom(
    kit.startDiscovering({
      transport: transport === "usb" ? webHidIdentifier : speculosIdentifier,
    })
  );
  const sessionId = await kit.connect({ device });
  return new SignerXrpBuilder({ dmk: kit, sessionId }).build();
}

/** DMK device actions return { observable, cancel }; resolve on completion. */
export function runAction<T>(
  action: { observable: { subscribe: Function } },
  onProgress?: (msg: string) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    action.observable.subscribe({
      next: (state: any) => {
        const interaction = state?.intermediateValue?.requiredUserInteraction;
        if (interaction && interaction !== "none" && onProgress) {
          onProgress(`Action required on device: ${interaction}`);
        }
        if (state.status === DeviceActionStatus.Completed) resolve(state.output as T);
        else if (state.status === DeviceActionStatus.Error)
          reject(state.error ?? new Error("Device action failed"));
        else if (state.status === DeviceActionStatus.Stopped)
          reject(new Error("Device action stopped"));
      },
      error: reject,
    });
  });
}

export async function getDeviceAddress(
  signer: SignerXrp,
  onProgress?: (msg: string) => void
): Promise<{ address: string; publicKey: string }> {
  return runAction(signer.getAddress(DERIVATION_PATH, { checkOnDevice: false }), onProgress);
}

export async function signOnDevice(
  signer: SignerXrp,
  unsignedTxHex: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const der = await runAction<Uint8Array>(
    signer.signTransaction(DERIVATION_PATH, hexaStringToBuffer(unsignedTxHex)!),
    onProgress
  );
  return bufferToHexaString(der, false).toUpperCase();
}
