import type { DisplayIntent } from "xrpl-clear";

/**
 * "My activity": the transactions checked in this browser, kept in
 * localStorage. Nothing leaves the browser; clearing site data clears it.
 */
export interface ActivityEntry {
  id: string;
  /** Last time this transaction was opened (ms) */
  at: number;
  /** Where it came from: scenario title, "Pasted transaction", "Live: Payment", … */
  source: string;
  txType: string;
  title: string;
  summary: string;
  dangers: number;
  warns: number;
  /** The transaction as entered (JSON or hex), to reopen it */
  input: string;
  /** Last simulate engine result */
  simulated?: string;
  signed?: { result: string; hash: string };
}

const KEY = "cs.activity.v1";
const MAX = 50;

export function loadActivity(): ActivityEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveActivity(list: ActivityEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
}

/** Put a just-opened transaction on top; reopening the same input keeps its simulate/sign results. */
export function recordOpened(list: ActivityEntry[], input: string, source: string, intent: DisplayIntent): [ActivityEntry[], string] {
  const existing = list.find((e) => e.input === input);
  const entry: ActivityEntry = {
    ...existing,
    id: existing?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    source,
    txType: intent.txType,
    title: intent.title,
    summary: intent.summary,
    dangers: intent.warnings.filter((w) => w.severity === "danger").length,
    warns: intent.warnings.filter((w) => w.severity === "warn").length,
    input,
  };
  return [[entry, ...list.filter((e) => e.id !== entry.id)], entry.id];
}

export function updateEntry(list: ActivityEntry[], id: string, patch: Partial<ActivityEntry>): ActivityEntry[] {
  return list.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

/** "2 min ago", "3 h ago", or a date */
export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Merge two activity lists (e.g. this browser's and the account's): the same
 * transaction input is one entry, keeping the newest open and any simulate/sign result.
 */
export function mergeActivity(a: ActivityEntry[], b: ActivityEntry[]): ActivityEntry[] {
  const byInput = new Map<string, ActivityEntry>();
  for (const e of [...a, ...b]) {
    const prev = byInput.get(e.input);
    if (!prev) {
      byInput.set(e.input, e);
      continue;
    }
    const [newer, older] = e.at >= prev.at ? [e, prev] : [prev, e];
    byInput.set(e.input, { ...older, ...newer, simulated: newer.simulated ?? older.simulated, signed: newer.signed ?? older.signed });
  }
  return [...byInput.values()].sort((x, y) => y.at - x.at).slice(0, MAX);
}
