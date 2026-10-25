import type { DisplayField, DisplayIntent, RenderContext, RiskFlag } from "../types";
import { amountCurrencyName, amountNumeric, formatAmount, rippleTimeToISO, setFlags } from "../format";

const OFFER_FLAGS = {
  tfPassive: 0x00010000,
  tfImmediateOrCancel: 0x00020000,
  tfFillOrKill: 0x00040000,
  tfSell: 0x00080000,
};

export function renderOfferCreate(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const gets = tx.TakerGets; // what the offer creator gives up
  const pays = tx.TakerPays; // what the offer creator receives
  const warnings: RiskFlag[] = [];
  const fields: DisplayField[] = [];
  const flagNames = setFlags(tx.Flags, OFFER_FLAGS);

  fields.push({ label: "You give", value: formatAmount(gets, ctx.registry) });
  fields.push({ label: "You receive", value: formatAmount(pays, ctx.registry) });

  const g = amountNumeric(gets);
  const p = amountNumeric(pays);
  if (g && p && g > 0) {
    const rate = p / g;
    fields.push({
      label: "Effective price",
      value: `${rate.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${amountCurrencyName(pays)} per ${amountCurrencyName(gets)}`,
    });
  }
  if (tx.Expiration !== undefined) {
    fields.push({ label: "Expires", value: rippleTimeToISO(tx.Expiration) });
  }
  if (flagNames.length) fields.push({ label: "Flags", value: flagNames.join(", ") });
  if (flagNames.includes("tfFillOrKill")) {
    warnings.push({ code: "FILL_OR_KILL", severity: "info", message: "Fill-or-kill: executes completely now or not at all." });
  }

  return {
    txType: "OfferCreate",
    title: "Place DEX offer",
    summary: `Offer ${formatAmount(gets)} in exchange for ${formatAmount(pays)} on the XRPL DEX.`,
    fields,
    warnings,
    raw: tx,
  };
}
