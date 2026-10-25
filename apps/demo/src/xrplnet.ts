import { Client, encode, getBalanceChanges } from "xrpl";
import type { SimulationResult } from "xrpl-clear-signing";

export const DEFAULT_WSS = "wss://s.altnet.rippletest.net:51233";
const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";

let client: Client | undefined;
let clientUrl = "";

async function connected(url: string): Promise<Client> {
  if (client && clientUrl === url && client.isConnected()) return client;
  if (client) {
    try {
      await client.disconnect();
    } catch {}
  }
  client = new Client(url);
  clientUrl = url;
  await client.connect();
  return client;
}

/**
 * XLS-69 dry run over WebSocket. The browser build uses this instead of the
 * core library's fetch version: the public testnet JSON-RPC server sends no
 * CORS headers, but WebSocket connections aren't subject to CORS.
 */
export async function simulateViaWs(
  url: string,
  txJson: Record<string, unknown>
): Promise<SimulationResult> {
  const c = await connected(url);
  try {
    const res: any = await c.request({ command: "simulate", tx_json: txJson } as any);
    const r = res?.result ?? {};
    let balanceChanges: SimulationResult["balanceChanges"];
    try {
      if (r.meta) balanceChanges = getBalanceChanges(r.meta);
    } catch {}
    return {
      engineResult: r.engine_result ?? "unknown",
      message: r.engine_result_message,
      balanceChanges,
      raw: r,
    };
  } catch (e: any) {
    return {
      engineResult: e?.data?.error ?? "error",
      message: e?.data?.error_message ?? e?.message ?? String(e),
      raw: e?.data ?? {},
    };
  }
}

export async function getBalanceOrNull(url: string, address: string): Promise<number | null> {
  const c = await connected(url);
  try {
    return await c.getXrpBalance(address);
  } catch (e: any) {
    if (e?.data?.error === "actNotFound") return null;
    throw e;
  }
}

export async function fundFromFaucet(url: string, address: string): Promise<number> {
  const res = await fetch(FAUCET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: address }),
  });
  if (!res.ok) throw new Error(`Faucet failed: ${res.status}`);
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const b = await getBalanceOrNull(url, address);
    if (b !== null) return b;
  }
  throw new Error("Faucet funding did not land in time");
}

/** Fill in Account/SigningPubKey/Fee/Sequence so the device signs exactly what we preview. */
export async function prepareForDevice(
  url: string,
  tx: Record<string, any>,
  address: string,
  publicKey: string
): Promise<Record<string, any>> {
  const c = await connected(url);
  const draft: Record<string, any> = {
    ...tx,
    Account: address,
    SigningPubKey: publicKey.toUpperCase(),
  };
  delete draft.TxnSignature;
  const prepared = await c.autofill(draft as any);
  // autofill leaves ~1 minute to sign; give 10 so the device screen can be read.
  (prepared as any).LastLedgerSequence = (await c.getLedgerIndex()) + 150;
  return prepared as Record<string, any>;
}

export const encodeUnsigned = (tx: Record<string, any>): string => encode(tx as any);

export async function submitSigned(
  url: string,
  tx: Record<string, any>,
  txnSignature: string
): Promise<{ hash: string; result: string }> {
  const c = await connected(url);
  const signed = encode({ ...tx, TxnSignature: txnSignature } as any);
  const res = await c.submitAndWait(signed);
  const meta = res.result.meta;
  return {
    hash: res.result.hash,
    result: typeof meta === "object" && meta ? (meta as any).TransactionResult : "unknown",
  };
}
