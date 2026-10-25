import type { DisplayIntent, MetadataDocument, Registry, RenderContext, Renderer } from "./types";
import { toTxJson } from "./decode";
import { defaultRegistry } from "./registry";
import { renderFromMetadata, validateMetadata } from "./metadata";
import trustSetMetadata from "../metadata/TrustSet.json";
import { renderPayment } from "./renderers/payment";
import { renderOfferCreate } from "./renderers/offercreate";
import { renderEscrowCreate } from "./renderers/escrowcreate";
import { renderAMMDeposit } from "./renderers/ammdeposit";
import { renderBatch } from "./renderers/batch";
import { renderFallback } from "./renderers/fallback";

/** Built-in display metadata documents, keyed by transaction type. */
const builtinMetadata: Record<string, MetadataDocument> = Object.fromEntries(
  [trustSetMetadata as MetadataDocument].map((d) => [d.txType, validateMetadata(d)])
);

/** Types not (yet) expressible as metadata: hand-written renderers. */
const renderers: Record<string, Renderer> = {
  Payment: renderPayment,
  OfferCreate: renderOfferCreate,
  EscrowCreate: renderEscrowCreate,
  AMMDeposit: renderAMMDeposit,
  Batch: renderBatch,
};

export interface ExplainOptions {
  registry?: Registry;
  /** Extra display metadata documents; they override built-ins of the same txType. */
  metadata?: MetadataDocument[];
}

/**
 * Turn a transaction (signing blob hex, JSON string, or object) into a
 * structured, risk-annotated, human-readable DisplayIntent.
 */
export function explain(input: string | object, opts: ExplainOptions = {}): DisplayIntent {
  const tx = toTxJson(input);
  const ctx: RenderContext = { registry: opts.registry ?? defaultRegistry };
  const metadata = { ...builtinMetadata };
  for (const d of opts.metadata ?? []) metadata[d.txType] = validateMetadata(d);
  ctx.renderNested = (inner) => dispatch(inner, ctx, metadata);
  return dispatch(tx, ctx, metadata);
}

/** Metadata document first, then a hand-written renderer, then the safe fallback. */
function dispatch(tx: Record<string, any>, ctx: RenderContext, metadata: Record<string, MetadataDocument>): DisplayIntent {
  const type = String(tx.TransactionType ?? "Unknown");
  const doc = metadata[type];
  if (doc) return renderFromMetadata(doc, tx, ctx);
  const renderer = renderers[type] ?? renderFallback;
  return renderer(tx, ctx);
}

export * from "./types";
export { toTxJson } from "./decode";
export { renderFromMetadata, validateMetadata } from "./metadata";
export { toDeviceScreens, truncateMiddle, type DeviceScreen, type DeviceProfileOptions } from "./device";
export { builtinMetadata };
export { simulateTx, DEFAULT_TESTNET_RPC, type SimulationResult } from "./simulate";
export { defaultRegistry, withEntries, canonicalIssuerFor } from "./registry";
export {
  decodeCurrency,
  formatAmount,
  formatAccount,
  rippleTimeToISO,
  truncateAddress,
} from "./format";
