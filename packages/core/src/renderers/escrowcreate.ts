import type { DisplayField, DisplayIntent, RenderContext, RiskFlag } from "../types";
import { formatAccount, formatAmount, rippleTimeToISO } from "../format";

export function renderEscrowCreate(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const warnings: RiskFlag[] = [];
  const fields: DisplayField[] = [];
  const dest = String(tx.Destination ?? "?");

  fields.push({ label: "Lock", value: formatAmount(tx.Amount, ctx.registry) });
  fields.push({ label: "Releasable to", value: formatAccount(dest, ctx.registry), account: dest });
  if (tx.FinishAfter !== undefined) fields.push({ label: "Releasable after", value: rippleTimeToISO(tx.FinishAfter) });
  if (tx.CancelAfter !== undefined) fields.push({ label: "Refundable after", value: rippleTimeToISO(tx.CancelAfter) });
  if (tx.Condition) {
    fields.push({ label: "Condition", value: "Crypto-condition required to release" });
  }
  if (tx.FinishAfter === undefined && !tx.Condition) {
    warnings.push({
      code: "ESCROW_NO_RELEASE_GATE",
      severity: "warn",
      message: "No FinishAfter time and no condition: check how these funds are meant to be released.",
    });
  }

  return {
    txType: "EscrowCreate",
    title: "Create escrow",
    summary: `Lock ${formatAmount(tx.Amount)} for ${formatAccount(dest, ctx.registry)}${
      tx.FinishAfter !== undefined ? `, releasable after ${rippleTimeToISO(tx.FinishAfter)}` : ""
    }.`,
    fields,
    warnings,
    raw: tx,
  };
}
