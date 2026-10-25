import type { DisplayField, DisplayIntent, RenderContext, RiskFlag } from "../types";
import { decodeCurrency, formatAccount, formatAmount } from "../format";

// XLS-30: exactly one deposit-mode flag must be set.
const MODES: Record<string, { bit: number; label: string }> = {
  tfLPToken: { bit: 0x00010000, label: "balanced deposit for exact LP tokens" },
  tfSingleAsset: { bit: 0x00080000, label: "single-sided deposit of an exact amount" },
  tfTwoAsset: { bit: 0x00100000, label: "balanced deposit up to both amounts" },
  tfOneAssetLPToken: { bit: 0x00200000, label: "single-sided deposit for exact LP tokens" },
  tfLimitLPToken: { bit: 0x00400000, label: "single-sided deposit with a max price" },
  tfTwoAssetIfEmpty: { bit: 0x00800000, label: "seed an empty pool" },
};
const SINGLE_SIDED = new Set(["tfSingleAsset", "tfOneAssetLPToken", "tfLimitLPToken"]);

interface Issue {
  currency?: string;
  issuer?: string;
}

function formatIssue(issue: Issue | undefined, ctx: RenderContext): string {
  if (!issue?.currency) return "?";
  const name = decodeCurrency(issue.currency);
  if (name === "XRP" || issue.currency === "XRP") return "XRP";
  return issue.issuer ? `${name} (${formatAccount(issue.issuer, ctx.registry)})` : name;
}

export function renderAMMDeposit(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const warnings: RiskFlag[] = [];
  const fields: DisplayField[] = [];
  const flags: number = tx.Flags ?? 0;

  const setModes = Object.entries(MODES).filter(([, m]) => (flags & m.bit) === m.bit);
  const mode = setModes[0]?.[0];
  const pool = `${formatIssue(tx.Asset, ctx)} / ${formatIssue(tx.Asset2, ctx)}`;

  fields.push({ label: "Pool", value: pool });
  fields.push({
    label: "Mode",
    value: setModes.length ? setModes.map(([n, m]) => `${n} — ${m.label}`).join("; ") : "none set",
    risk: setModes.length === 1 ? undefined : "danger",
  });
  if (tx.Amount !== undefined) fields.push({ label: "Deposit", value: formatAmount(tx.Amount, ctx.registry) });
  if (tx.Amount2 !== undefined) fields.push({ label: "Deposit (2nd asset)", value: formatAmount(tx.Amount2, ctx.registry) });
  if (tx.LPTokenOut !== undefined) fields.push({ label: "LP tokens out", value: formatAmount(tx.LPTokenOut, ctx.registry) });
  if (tx.EPrice !== undefined) fields.push({ label: "Max effective price", value: formatAmount(tx.EPrice, ctx.registry) });

  if (setModes.length !== 1) {
    warnings.push({
      code: "AMM_MODE_INVALID",
      severity: "danger",
      message: "AMMDeposit requires exactly one deposit-mode flag; the ledger will reject this transaction (temMALFORMED).",
    });
  }
  if (mode && SINGLE_SIDED.has(mode)) {
    warnings.push({
      code: "SINGLE_SIDED_DEPOSIT",
      severity: "warn",
      message:
        "Single-sided deposit: part of your asset is effectively swapped inside the pool (fee + slippage), so you receive less pool share than a balanced deposit of equal value.",
    });
    if (tx.LPTokenOut === undefined && tx.EPrice === undefined) {
      warnings.push({
        code: "NO_DEPOSIT_BOUND",
        severity: "warn",
        message: "No LPTokenOut or EPrice bound set: there is no guaranteed minimum on what this deposit returns.",
      });
    }
  }
  if (mode === "tfTwoAssetIfEmpty") {
    warnings.push({
      code: "POOL_SEEDING",
      severity: "danger",
      message:
        "Seeding an empty pool: your two amounts set the pool's starting price. A ratio off from market price is an immediate arbitrage loss.",
    });
  }

  return {
    txType: "AMMDeposit",
    title: "Deposit into AMM pool",
    summary: `Deposit ${tx.Amount !== undefined ? formatAmount(tx.Amount) : "liquidity"}${
      tx.Amount2 !== undefined ? ` + ${formatAmount(tx.Amount2)}` : ""
    } into the ${pool} pool${mode ? ` (${MODES[mode].label})` : ""}.`,
    fields,
    warnings,
    raw: tx,
  };
}
