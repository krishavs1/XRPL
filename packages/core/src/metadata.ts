import type { DisplayField, DisplayIntent, MetadataDocument, Registry, RenderContext, RiskFlag, RiskWhen } from "./types";
import { decodeCurrency, formatAccount, formatAmount, rippleTimeToISO, setFlags, truncateAddress } from "./format";
import { canonicalIssuersFor } from "./registry";

/**
 * Interpreter for display metadata documents (spec: "Display metadata document").
 * A document fully describes how one transaction type renders — fields, intent
 * template, flag names and risk rules — so new types need no code changes.
 */

const CONDITION_OPS = ["not", "and", "or", "gte", "flag", "missing", "verified", "impersonates", "requiresTag"];
const FORMATS = ["raw", "decimal", "currency", "account", "address", "amount", "rippleTime", "flags", "canonicalIssuers"];

/** Resolve a dotted field path ("LimitAmount.issuer") against a transaction. */
export function resolvePath(tx: Record<string, any>, path: string): unknown {
  let cur: any = tx;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}

function formatValue(value: unknown, format: string, doc: MetadataDocument, registry: Registry): string {
  if (value === undefined || value === null) return "—";
  switch (format) {
    case "currency":
      return decodeCurrency(String(value));
    case "account":
      return formatAccount(String(value), registry);
    case "address":
      return truncateAddress(String(value));
    case "amount":
      return formatAmount(value as any, registry);
    case "rippleTime":
      return rippleTimeToISO(Number(value));
    case "flags":
      return setFlags(Number(value), doc.flags ?? {}).join(", ");
    case "canonicalIssuers":
      return canonicalIssuersFor(decodeCurrency(String(value)), registry)
        .map((c) => `${c.name} (${truncateAddress(c.address)})`)
        .join(", ");
    default: // raw, decimal
      return String(value);
  }
}

/** Fill a template: "{path}" or "{path|format}". */
function fillTemplate(template: string, tx: Record<string, any>, doc: MetadataDocument, registry: Registry): string {
  return template.replace(/\{([^}|]+)(?:\|([^}]+))?\}/g, (_, path: string, format?: string) =>
    formatValue(resolvePath(tx, path.trim()), format?.trim() ?? "raw", doc, registry)
  );
}

function evaluate(when: RiskWhen, tx: Record<string, any>, doc: MetadataDocument, registry: Registry): boolean {
  const [op, arg] = Object.entries(when)[0] as [string, any];
  switch (op) {
    case "not":
      return !evaluate(arg, tx, doc, registry);
    case "and":
      return (arg as RiskWhen[]).every((c) => evaluate(c, tx, doc, registry));
    case "or":
      return (arg as RiskWhen[]).some((c) => evaluate(c, tx, doc, registry));
    case "gte": {
      const n = Number(resolvePath(tx, arg[0]));
      return Number.isFinite(n) && n >= arg[1];
    }
    case "flag": {
      const bit = doc.flags?.[arg];
      return bit !== undefined && (Number(tx.Flags ?? 0) & bit) === bit;
    }
    case "missing":
      return resolvePath(tx, arg) === undefined;
    case "verified":
      return registry.accounts[String(resolvePath(tx, arg))]?.verified === true;
    case "impersonates": {
      const name = decodeCurrency(String(resolvePath(tx, arg.currency) ?? ""));
      const issuer = String(resolvePath(tx, arg.issuer));
      const canonicals = canonicalIssuersFor(name, registry);
      return canonicals.length > 0 && !canonicals.some((c) => c.address === issuer);
    }
    case "requiresTag":
      return registry.accounts[String(resolvePath(tx, arg))]?.requiresDestinationTag === true;
    default:
      throw new Error(`Unknown condition "${op}"`);
  }
}

function validateWhen(when: RiskWhen, where: string): void {
  const keys = Object.keys(when ?? {});
  if (keys.length !== 1 || !CONDITION_OPS.includes(keys[0])) {
    throw new Error(`${where}: condition must have exactly one of ${CONDITION_OPS.join(", ")}`);
  }
  const arg = (when as any)[keys[0]];
  if (keys[0] === "not") validateWhen(arg, where);
  if (keys[0] === "and" || keys[0] === "or") (arg as RiskWhen[]).forEach((c) => validateWhen(c, where));
}

/**
 * Check a document's structure up front, so a malformed document fails at
 * load time rather than silently dropping a warning at signing time.
 */
export function validateMetadata(doc: MetadataDocument): MetadataDocument {
  const where = `metadata ${doc?.txType ?? "?"}`;
  if (!doc?.txType || !doc.title || !doc.intent) throw new Error(`${where}: txType, title and intent are required`);
  for (const f of doc.fields ?? []) {
    if (f.format && !FORMATS.includes(f.format)) throw new Error(`${where}: unknown format "${f.format}"`);
  }
  const codes = new Set((doc.risks ?? []).map((r) => r.code));
  for (const r of doc.risks ?? []) validateWhen(r.when, `${where} risk ${r.code}`);
  for (const f of doc.fields ?? []) {
    for (const c of f.risks ?? []) if (!codes.has(c)) throw new Error(`${where}: field ${f.label} references unknown risk ${c}`);
  }
  return doc;
}

/** Render a transaction from its display metadata document. */
export function renderFromMetadata(doc: MetadataDocument, tx: Record<string, any>, ctx: RenderContext): DisplayIntent {
  const { registry } = ctx;

  const fired = (doc.risks ?? []).filter((r) => evaluate(r.when, tx, doc, registry));
  const warnings: RiskFlag[] = fired.map((r) => ({
    code: r.code,
    severity: r.severity,
    message: fillTemplate(r.message, tx, doc, registry),
  }));

  const fields: DisplayField[] = [];
  for (const f of doc.fields ?? []) {
    const value = formatValue(resolvePath(tx, f.path), f.format ?? "raw", doc, registry);
    if (f.hideIfEmpty && (value === "" || value === "—")) continue;
    const linked = fired.filter((r) => f.risks?.includes(r.code));
    const notes = linked.map((r) => r.short).filter(Boolean);
    const raw = resolvePath(tx, f.path);
    fields.push({
      label: f.label,
      value: notes.length ? `${value} (${notes.join(", ")})` : value,
      risk: linked.find((r) => r.severity === "danger")?.severity ?? linked[0]?.severity,
      ...(f.format === "account" && typeof raw === "string" ? { account: raw } : {}),
    });
  }

  return {
    txType: doc.txType,
    title: doc.title,
    summary: fillTemplate(doc.intent, tx, doc, registry),
    fields,
    warnings,
    raw: tx,
  };
}
