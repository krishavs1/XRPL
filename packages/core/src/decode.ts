import { decode } from "xrpl";

/** Accept a signing blob (hex), a JSON string, or a parsed tx object; return tx JSON. */
export function toTxJson(input: string | object): Record<string, any> {
  if (typeof input !== "string") return input as Record<string, any>;
  const s = input.trim();
  if (s.startsWith("{")) return JSON.parse(s);
  const hex = s.replace(/^0x/i, "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("Input is neither JSON nor a hex signing blob");
  }
  return decode(hex) as Record<string, any>;
}
