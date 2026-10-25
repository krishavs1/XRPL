import type { DisplayField, DisplayIntent, RenderContext, RiskFlag } from "../types";
import { amountCurrencyName, formatAccount, formatAmount } from "../format";

const PAYMENT_FLAGS = {
  tfNoRippleDirect: 0x00010000,
  tfPartialPayment: 0x00020000,
  tfLimitQuality: 0x00040000,
};

export function renderPayment(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const amount = tx.Amount ?? tx.DeliverMax;
  const warnings: RiskFlag[] = [];
  const fields: DisplayField[] = [];
  const dest = String(tx.Destination ?? "?");
  const destEntry = ctx.registry.accounts[dest];
  const partial = ((tx.Flags ?? 0) & PAYMENT_FLAGS.tfPartialPayment) !== 0;

  fields.push({ label: "To", value: formatAccount(dest, ctx.registry) });
  fields.push({ label: "Amount", value: formatAmount(amount, ctx.registry), risk: partial ? "danger" : undefined });
  if (tx.SendMax) {
    fields.push({ label: "Send max", value: formatAmount(tx.SendMax, ctx.registry) });
    if (amountCurrencyName(tx.SendMax) !== amountCurrencyName(amount)) {
      fields.push({ label: "Conversion", value: `${amountCurrencyName(tx.SendMax)} → ${amountCurrencyName(amount)} (cross-currency)` });
    }
  }
  if (tx.DeliverMin) fields.push({ label: "Deliver at least", value: formatAmount(tx.DeliverMin, ctx.registry) });
  if (tx.DestinationTag !== undefined) fields.push({ label: "Destination tag", value: String(tx.DestinationTag) });

  if (partial) {
    warnings.push({
      code: "PARTIAL_PAYMENT",
      severity: "danger",
      message: "Partial payment: the recipient may receive LESS than the stated Amount. Never trust the Amount field of a partial payment.",
    });
  }
  if (destEntry?.requiresDestinationTag && tx.DestinationTag === undefined) {
    warnings.push({
      code: "MISSING_DESTINATION_TAG",
      severity: "warn",
      message: `${destEntry.name} requires a destination tag; funds sent without one may be lost or delayed.`,
    });
  }
  if (tx.Paths) {
    fields.push({ label: "Pathfinding", value: "Uses explicit payment paths" });
  }

  return {
    txType: "Payment",
    title: "Send payment",
    summary: `Send ${formatAmount(amount)} to ${formatAccount(dest, ctx.registry)}${partial ? " (partial payment!)" : ""}.`,
    fields,
    warnings,
    raw: tx,
  };
}
