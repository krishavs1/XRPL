import type { DisplayField, DisplayIntent, MetadataDocument, MetadataField, Registry, RenderContext, RiskFlag, RiskWhen } from "./types";
import { decodeCurrency, formatAccount, formatAmount, rippleTimeToISO, setFlags, truncateAddress } from "./format";
import { canonicalIssuersFor } from "./registry";

/**
 * Interpreter for display metadata documents (spec: "Display metadata document").
 * A document fully describes how one transaction type renders - fields, intent
 * template, flag names and risk rules - so new types need no code changes.
 */

const CONDITION_OPS = ["not", "and", "or", "gte", "eq", "flag", "missing", "verified", "impersonates", "requiresTag", "isXrp", "exactlyOneFlag"];
const FORMATS = ["raw", "decimal", "currency", "account", "address", "amount", "rippleTime", "flags", "canonicalIssuers", "hexText", "issue"];

/**
 * Resolve a dotted field path ("LimitAmount.issuer") against a transaction.
 * A `*` segment maps over an array ("SignerEntries.*.SignerEntry.Account").
 */
export function resolvePath(tx: Record<string, any>, path: string): unknown {
  return walk(tx, path.split("."));
}

function walk(cur: any, keys: string[]): unknown {
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] === "*") return Array.isArray(cur) ? cur.map((el) => walk(el, keys.slice(i + 1))) : undefined;
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[keys[i]];
  }
  return cur;
}

/** Hex-encoded ASCII (e.g. AccountSet Domain) → text; non-printable input stays hex. */
function hexToText(hex: string): string {
  if (!/^([0-9a-fA-F]{2})+$/.test(hex)) return hex;
  const bytes = hex.match(/../g)!.map((b) => parseInt(b, 16));
  return bytes.every((b) => b >= 0x20 && b <= 0x7e) ? String.fromCharCode(...bytes) : hex;
}

function formatValue(value: unknown, format: string, doc: MetadataDocument, registry: Registry): string {
  if (value === undefined || value === null) return "-";
  if (Array.isArray(value)) return value.map((v) => formatValue(v, format, doc, registry)).join(", ");
  if (format.startsWith("enum:")) {
    return doc.enums?.[format.slice(5)]?.[String(value)] ?? `unknown value (${value})`;
  }
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
    case "hexText":
      return hexToText(String(value));
    case "issue": {
      // An Issue object ({currency, issuer?}), e.g. an AMM pool side
      const v = value as { currency?: string; issuer?: string };
      if (typeof v !== "object") return String(value);
      const name = decodeCurrency(String(v.currency ?? "?"));
      if (name === "XRP") return "XRP";
      return v.issuer ? `${name} (${formatAccount(v.issuer, registry)})` : name;
    }
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
    case "eq": {
      const v = resolvePath(tx, arg[0]);
      return v !== undefined && String(v) === String(arg[1]);
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
    case "isXrp":
      return typeof resolvePath(tx, arg) === "string";
    case "exactlyOneFlag": {
      const flags = Number(tx.Flags ?? 0);
      const set = (arg as string[]).filter((name) => {
        const bit = doc.flags?.[name];
        return bit !== undefined && (flags & bit) === bit;
      });
      return set.length === 1;
    }
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

function validateFormat(format: string, doc: MetadataDocument, where: string): void {
  const ok = format.startsWith("enum:") ? doc.enums?.[format.slice(5)] !== undefined : FORMATS.includes(format);
  if (!ok) throw new Error(`${where}: unknown format "${format}"`);
}

/** Formats named inside a template ("{path|format}"). */
function templateFormats(template: string): string[] {
  return [...template.matchAll(/\{[^}|]+\|([^}]+)\}/g)].map((m) => m[1].trim());
}

/**
 * Check a document's structure up front, so a malformed document fails at
 * load time rather than silently dropping a warning at signing time.
 */
export function validateMetadata(doc: MetadataDocument): MetadataDocument {
  const where = `metadata ${doc?.txType ?? "?"}`;
  if (!doc?.txType || !doc.title || !doc.intent) throw new Error(`${where}: txType, title and intent are required`);
  const intents = typeof doc.intent === "string" ? [{ text: doc.intent }] : doc.intent;
  if (!Array.isArray(intents) || !intents.length || intents[intents.length - 1].when) {
    throw new Error(`${where}: intent variants must end with one that has no "when"`);
  }
  for (const i of intents) if (i.when) validateWhen(i.when, `${where} intent`);
  const templates = [...intents.map((i) => i.text), ...(doc.risks ?? []).map((r) => r.message)];
  for (const t of templates) for (const fmt of templateFormats(t)) validateFormat(fmt, doc, where);
  for (const f of doc.fields ?? []) if (f.format) validateFormat(f.format, doc, where);
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
  const push = (f: MetadataField, label: string, raw: unknown) => {
    const value = formatValue(raw, f.format ?? "raw", doc, registry);
    if (f.hideIfEmpty && (value === "" || value === "-")) return;
    const linked = fired.filter((r) => f.risks?.includes(r.code));
    const notes = linked.map((r) => r.short).filter(Boolean);
    fields.push({
      label,
      value: notes.length ? `${value} (${notes.join(", ")})` : value,
      risk: linked.find((r) => r.severity === "danger")?.severity ?? linked[0]?.severity,
      ...(f.format === "account" && typeof raw === "string" ? { account: raw } : {}),
    });
  };
  for (const f of doc.fields ?? []) {
    const raw = resolvePath(tx, f.path);
    // A list of accounts gets one field each, so the device's verified-name rule applies per account
    if (f.format === "account" && Array.isArray(raw)) raw.forEach((a, i) => push(f, `${f.label} ${i + 1}`, a));
    else push(f, f.label, raw);
  }

  const intents = typeof doc.intent === "string" ? [{ text: doc.intent }] : doc.intent;
  const intent = intents.find((i) => !i.when || evaluate(i.when, tx, doc, registry))!;

  return {
    txType: doc.txType,
    title: doc.title,
    summary: fillTemplate(intent.text, tx, doc, registry),
    fields,
    warnings,
    raw: tx,
  };
}
