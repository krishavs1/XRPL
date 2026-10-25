import { getBalanceChanges } from "xrpl";

export interface SimulationResult {
  engineResult: string;
  message?: string;
  /** Per-account balance changes projected by the dry run */
  balanceChanges?: ReturnType<typeof getBalanceChanges>;
  raw: Record<string, any>;
}

export const DEFAULT_TESTNET_RPC = "https://s.altnet.rippletest.net:51234/";

/**
 * Dry-run a transaction against current ledger state via the `simulate` RPC
 * (XLS-69, available since rippled 2.4.0 - no amendment required).
 * Fee / Sequence / SigningPubKey may be omitted; the server autofills them.
 */
export async function simulateTx(
  txJson: Record<string, unknown>,
  endpoint: string = DEFAULT_TESTNET_RPC
): Promise<SimulationResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "simulate", params: [{ tx_json: txJson }] }),
  });
  const json: any = await res.json();
  const r = json?.result ?? {};
  let balanceChanges: SimulationResult["balanceChanges"];
  try {
    if (r.meta) balanceChanges = getBalanceChanges(r.meta);
  } catch {
    // meta shape unexpected - leave balanceChanges undefined
  }
  return {
    engineResult: r.engine_result ?? r.error ?? "unknown",
    message: r.engine_result_message ?? r.error_message,
    balanceChanges,
    raw: r,
  };
}
