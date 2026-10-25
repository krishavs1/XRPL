import type { Registry, RegistryEntry } from "./types";
import issuers from "../registry/issuers.json";

export const defaultRegistry: Registry = issuers as Registry;

/** Find the canonical verified issuer of a currency name, if any (impersonation checks). */
export function canonicalIssuerFor(currencyName: string, registry: Registry): RegistryEntry | undefined {
  return Object.values(registry.accounts).find(
    (e) => e.verified && e.currencies?.includes(currencyName)
  );
}

/** Merge extra entries (e.g. the testnet RLUSD issuer handed out at the event) into a registry. */
export function withEntries(registry: Registry, entries: RegistryEntry[]): Registry {
  const accounts = { ...registry.accounts };
  for (const e of entries) accounts[e.address] = e;
  return { ...registry, accounts };
}
