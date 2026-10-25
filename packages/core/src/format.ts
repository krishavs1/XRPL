import type { Registry } from "./types";

const RIPPLE_EPOCH = 946684800;

/** Decode a 160-bit hex currency code to a human name where possible. */
export function decodeCurrency(code: string): string {
  if (!code) return "?";
  if (code.length !== 40) return code; // standard 3-char code
  if (/^0+$/.test(code)) return "XRP";
  const first = code.slice(0, 2).toUpperCase();
  if (first === "03") return `AMM LP token (${code.slice(0, 10)}…)`;
  const bytes: number[] = [];
  for (let i = 0; i < 40; i += 2) bytes.push(parseInt(code.slice(i, i + 2), 16));
  while (bytes.length && bytes[bytes.length - 1] === 0) bytes.pop();
  const printable = bytes.length > 0 && bytes.every((b) => b >= 0x20 && b <= 0x7e);
  if (printable) return String.fromCharCode(...bytes);
  return `${code.slice(0, 12)}… (hex currency)`;
}

export interface IssuedAmount {
  currency: string;
  issuer: string;
  value: string;
}

export type Amount = string | IssuedAmount;

export function isIssuedAmount(a: Amount | undefined): a is IssuedAmount {
  return typeof a === "object" && a !== null && "currency" in a;
}

export function formatAmount(a: Amount | undefined, registry?: Registry): string {
  if (a === undefined || a === null) return "-";
  if (typeof a === "string") {
    const xrp = Number(a) / 1_000_000;
    return `${xrp.toLocaleString("en-US", { maximumFractionDigits: 6 })} XRP`;
  }
  const name = decodeCurrency(a.currency);
  const issuer = registry ? ` from ${formatAccount(a.issuer, registry)}` : "";
  return `${Number(a.value).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${name}${issuer}`;
}

export function amountNumeric(a: Amount | undefined): number | undefined {
  if (a === undefined || a === null) return undefined;
  if (typeof a === "string") return Number(a) / 1_000_000;
  const n = Number(a.value);
  return Number.isFinite(n) ? n : undefined;
}

export function amountCurrencyName(a: Amount | undefined): string {
  if (a === undefined || a === null) return "?";
  if (typeof a === "string") return "XRP";
  return decodeCurrency(a.currency);
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr ?? "?";
  return `${addr.slice(0, 7)}…${addr.slice(-5)}`;
}

export function formatAccount(addr: string, registry: Registry): string {
  const entry = registry.accounts[addr];
  if (entry) {
    return `${entry.name}${entry.verified ? " ✓" : ""} (${truncateAddress(addr)})`;
  }
  return `${truncateAddress(addr)} - unknown account`;
}

export function rippleTimeToISO(t: number | undefined): string {
  if (t === undefined || t === null) return "-";
  return new Date((t + RIPPLE_EPOCH) * 1000).toISOString().replace(".000Z", "Z");
}

/** Named flags set on a transaction, given a {name: bit} map. */
export function setFlags(flags: number | undefined, map: Record<string, number>): string[] {
  if (!flags) return [];
  return Object.entries(map)
    .filter(([, bit]) => (flags & bit) === bit)
    .map(([name]) => name);
}
