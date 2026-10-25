import { Client, Wallet, encode, getBalanceChanges } from "xrpl";
import type { SimulationResult } from "xrpl-clear-signing";

// Set VITE_XRPL_WSS in apps/demo/.env.local (gitignored — endpoint tokens stay
// out of the repo) to default every network call to that node, e.g. QuickNode.
export const DEFAULT_WSS =
  ((import.meta as any).env?.VITE_XRPL_WSS as string | undefined) ??
  "wss://s.altnet.rippletest.net:51233";
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
  // `simulate` only accepts unsigned drafts, and a transaction taken from the
  // live ledger carries a signature and an already-consumed Sequence. Strip
  // those so any transaction — including a validated one from the feed —
  // simulates as a clean "what would this do right now" replay (the server
  // autofills Sequence and fee).
  const draft = { ...txJson };
  delete draft.TxnSignature;
  delete draft.Signers;
  delete draft.SigningPubKey;
  delete draft.Sequence;
  delete draft.LastLedgerSequence;
  delete (draft as any).hash;
  try {
    const res: any = await c.request({ command: "simulate", tx_json: draft } as any);
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

let simAccount: Promise<string> | undefined;

/**
 * A funded testnet account to simulate as when no device is connected:
 * `simulate` needs an existing source account but no signature, so a fresh
 * faucet address (no key kept) is enough. Created once per page load.
 */
// Pre-funded, aged testnet account to simulate as (address only — simulate
// needs no key). Aged matters: e.g. AccountDelete simulates tecTOO_SOON on an
// account younger than ~256 ledgers. Faucet throwaway stays as the fallback.
const DEMO_SIM_ACCOUNT = "rJnHWdT8XysFvZdJUziqmAQjrDraivV8Po";

export function simulationAccount(url: string): Promise<string> {
  simAccount ??= (async () => {
    if ((await getBalanceOrNull(url, DEMO_SIM_ACCOUNT)) !== null) return DEMO_SIM_ACCOUNT;
    const address = Wallet.generate().address;
    await fundFromFaucet(url, address);
    return address;
  })();
  simAccount.catch(() => (simAccount = undefined)); // let a failed faucet call be retried
  return simAccount;
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
