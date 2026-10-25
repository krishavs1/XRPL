import type { DisplayField, DisplayIntent, RenderContext, RiskFlag } from "../types";
import { decodeCurrency, formatAccount, setFlags, truncateAddress } from "../format";
import { canonicalIssuerFor } from "../registry";

const TRUSTSET_FLAGS = {
  tfSetfAuth: 0x00010000,
  tfSetNoRipple: 0x00020000,
  tfClearNoRipple: 0x00040000,
  tfSetFreeze: 0x00100000,
  tfClearFreeze: 0x00200000,
};

/** Above this, treat the trustline limit as effectively unlimited. */
const UNLIMITED_THRESHOLD = 1_000_000_000;

export function renderTrustSet(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const limit = tx.LimitAmount ?? {};
  const currencyName = decodeCurrency(String(limit.currency ?? "?"));
  const issuer = String(limit.issuer ?? "?");
  const value = Number(limit.value ?? 0);
  const warnings: RiskFlag[] = [];
  const fields: DisplayField[] = [];

  const issuerEntry = ctx.registry.accounts[issuer];
  const canonical = canonicalIssuerFor(currencyName, ctx.registry);

  fields.push({ label: "Currency", value: currencyName });
  fields.push({
    label: "Issuer",
    value: formatAccount(issuer, ctx.registry),
    risk: issuerEntry?.verified ? undefined : "danger",
  });
  fields.push({
    label: "Limit",
    value: value >= UNLIMITED_THRESHOLD ? `${limit.value} (effectively unlimited)` : String(limit.value ?? "0"),
    risk: value >= UNLIMITED_THRESHOLD ? "danger" : undefined,
  });

  if (!issuerEntry?.verified) {
    warnings.push({
      code: "UNVERIFIED_ISSUER",
      severity: "danger",
      message: `Issuer ${truncateAddress(issuer)} is not in the verified registry.`,
    });
  }
  if (canonical && canonical.address !== issuer) {
    warnings.push({
      code: "CURRENCY_IMPERSONATION",
      severity: "danger",
      message: `"${currencyName}" is canonically issued by ${canonical.name} (${truncateAddress(
        canonical.address
      )}), but this trustline points at a different account. Likely a scam token.`,
    });
  }
  if (value >= UNLIMITED_THRESHOLD) {
    warnings.push({
      code: "UNLIMITED_TRUSTLINE",
      severity: "danger",
      message: "Trustline limit is effectively unlimited: you accept any amount of this token.",
    });
  }

  const flagNames = setFlags(tx.Flags, TRUSTSET_FLAGS);
  if (flagNames.length) fields.push({ label: "Flags", value: flagNames.join(", ") });

  return {
    txType: "TrustSet",
    title: "Set trustline",
    summary: `Trust up to ${limit.value ?? 0} ${currencyName} issued by ${formatAccount(issuer, ctx.registry)}.`,
    fields,
    warnings,
    raw: tx,
  };
}
