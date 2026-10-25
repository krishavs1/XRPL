import type { DisplayIntent, Registry, RenderContext, Renderer } from "./types";
import { toTxJson } from "./decode";
import { defaultRegistry } from "./registry";
import { renderTrustSet } from "./renderers/trustset";
import { renderPayment } from "./renderers/payment";
import { renderOfferCreate } from "./renderers/offercreate";
import { renderEscrowCreate } from "./renderers/escrowcreate";
import { renderAMMDeposit } from "./renderers/ammdeposit";
import { renderBatch } from "./renderers/batch";
import { renderFallback } from "./renderers/fallback";

const renderers: Record<string, Renderer> = {
  TrustSet: renderTrustSet,
  Payment: renderPayment,
  OfferCreate: renderOfferCreate,
  EscrowCreate: renderEscrowCreate,
  AMMDeposit: renderAMMDeposit,
  Batch: renderBatch,
};

export interface ExplainOptions {
  registry?: Registry;
}

/**
 * Turn a transaction (signing blob hex, JSON string, or object) into a
 * structured, risk-annotated, human-readable DisplayIntent.
 */
export function explain(input: string | object, opts: ExplainOptions = {}): DisplayIntent {
  const tx = toTxJson(input);
  const ctx: RenderContext = { registry: opts.registry ?? defaultRegistry };
  ctx.renderNested = (inner) => dispatch(inner, ctx);
  return dispatch(tx, ctx);
}

function dispatch(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const type = String(tx.TransactionType ?? "Unknown");
  const renderer = renderers[type] ?? renderFallback;
  return renderer(tx, ctx);
}

export * from "./types";
export { toTxJson } from "./decode";
export { simulateTx, DEFAULT_TESTNET_RPC, type SimulationResult } from "./simulate";
export { defaultRegistry, withEntries, canonicalIssuerFor } from "./registry";
export {
  decodeCurrency,
  formatAmount,
  formatAccount,
  rippleTimeToISO,
  truncateAddress,
} from "./format";
