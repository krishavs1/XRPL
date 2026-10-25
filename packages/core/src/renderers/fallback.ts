import type { DisplayField, DisplayIntent, RenderContext } from "../types";
import { formatAmount, isIssuedAmount } from "../format";

const SKIP_FIELDS = new Set(["TransactionType", "SigningPubKey", "TxnSignature", "Signers"]);

/** Generic renderer: anything parses, nothing silently disappears. */
export function renderFallback(tx: Record<string, any>, _ctx: RenderContext): DisplayIntent {
  const fields: DisplayField[] = [];
  for (const [key, value] of Object.entries(tx)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      fields.push({ label: key, value: String(value) });
    } else if (isIssuedAmount(value as any) || typeof value === "string") {
      fields.push({ label: key, value: formatAmount(value as any) });
    } else {
      fields.push({ label: key, value: JSON.stringify(value).slice(0, 120) });
    }
  }
  const type = String(tx.TransactionType ?? "Unknown");
  return {
    txType: type,
    title: type,
    summary: `No display metadata registered for ${type}; showing raw fields.`,
    fields,
    warnings: [
      {
        code: "NO_DISPLAY_METADATA",
        severity: "warn",
        message: `No display metadata for transaction type ${type}. Review raw fields before signing.`,
      },
    ],
    raw: tx,
  };
}
