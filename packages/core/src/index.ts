import type { DisplayIntent, MetadataDocument, Registry, RenderContext, Renderer } from "./types";
import { toTxJson } from "./decode";
import { defaultRegistry } from "./registry";
import { renderFromMetadata, validateMetadata } from "./metadata";
import trustSetMetadata from "../metadata/TrustSet.json";
import setRegularKeyMetadata from "../metadata/SetRegularKey.json";
import signerListSetMetadata from "../metadata/SignerListSet.json";
import accountSetMetadata from "../metadata/AccountSet.json";
import accountDeleteMetadata from "../metadata/AccountDelete.json";
import paymentMetadata from "../metadata/Payment.json";
import offerCreateMetadata from "../metadata/OfferCreate.json";
import escrowCreateMetadata from "../metadata/EscrowCreate.json";
import ammDepositMetadata from "../metadata/AMMDeposit.json";
import { renderBatch } from "./renderers/batch";
import { renderFallback } from "./renderers/fallback";

/** Built-in display metadata documents, keyed by transaction type. */
const builtinMetadata: Record<string, MetadataDocument> = Object.fromEntries(
  [
    trustSetMetadata,
    setRegularKeyMetadata,
    signerListSetMetadata,
    accountSetMetadata,
    accountDeleteMetadata,
    paymentMetadata,
    offerCreateMetadata,
    escrowCreateMetadata,
    ammDepositMetadata,
  ]
    .map((d) => d as unknown as MetadataDocument)
    .map((d) => [d.txType, validateMetadata(d)])
);

/**
 * Batch is the one hand-written renderer by design: the spec defines it as a
 * composition rule (inner transactions recurse through the whole pipeline),
 * not as per-type display metadata.
 */
const renderers: Record<string, Renderer> = {
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
