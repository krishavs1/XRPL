import type { DisplayField, DisplayIntent, RenderContext, RiskFlag } from "../types";

const BATCH_FLAGS: Record<string, number> = {
  tfAllOrNothing: 0x00010000,
  tfOnlyOne: 0x00020000,
  tfUntilFailure: 0x00040000,
  tfIndependent: 0x00080000,
};

function batchMode(flags: number | undefined): string {
  if (!flags) return "unspecified";
  for (const [name, bit] of Object.entries(BATCH_FLAGS)) {
    if ((flags & bit) === bit) return name.replace("tf", "");
  }
  return "unspecified";
}

/**
 * Batch (XLS-56): one approval executes up to 8 inner transactions.
 * This is the newest blind-signing surface on XRPL - we unfold every inner
 * transaction through the same pipeline so nothing hides inside a batch.
 */
export function renderBatch(tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const rawInner: any[] = Array.isArray(tx.RawTransactions) ? tx.RawTransactions : [];
  const innerTxs = rawInner
    .map((w) => w?.RawTransaction ?? w)
    .filter((t) => t && typeof t === "object");

  const inner: DisplayIntent[] = ctx.renderNested
    ? innerTxs.map((t) => ctx.renderNested!(t))
    : [];

  const warnings: RiskFlag[] = [
    {
      code: "BATCH_MULTI_EXECUTION",
      severity: "danger",
      message: `One approval executes ${innerTxs.length} inner transaction${innerTxs.length === 1 ? "" : "s"} (mode: ${batchMode(tx.Flags)}). Review every inner transaction below.`,
    },
  ];
  for (const i of inner) {
    for (const w of i.warnings) {
      warnings.push({ ...w, message: `[inner ${i.title}] ${w.message}` });
    }
  }

  const fields: DisplayField[] = [
    { label: "Mode", value: batchMode(tx.Flags) },
    { label: "Inner transactions", value: String(innerTxs.length), risk: "warn" },
    ...inner.map((i, idx) => ({
      label: `#${idx + 1} ${i.txType}`,
      value: i.summary,
      risk: i.warnings.some((w) => w.severity === "danger") ? ("danger" as const) : undefined,
    })),
  ];

  return {
    txType: "Batch",
    title: "Batch of transactions",
    summary: `Execute ${innerTxs.length} transactions with a single signature (${batchMode(tx.Flags)}).`,
    fields,
    warnings,
    inner,
    raw: tx,
  };
}
