import type { Registry, RegistryEntry } from "./types";
import issuers from "../registry/issuers.json";

export const defaultRegistry: Registry = issuers as Registry;

/** All verified canonical issuers of a currency name (a currency may have one per network). */
export function canonicalIssuersFor(currencyName: string, registry: Registry): RegistryEntry[] {
  return Object.values(registry.accounts).filter(
    (e) => e.verified && e.currencies?.includes(currencyName)
  );
}

/** First canonical verified issuer of a currency name, if any. */
export function canonicalIssuerFor(currencyName: string, registry: Registry): RegistryEntry | undefined {
  return canonicalIssuersFor(currencyName, registry)[0];
}

/** Merge extra entries (e.g. the testnet RLUSD issuer handed out at the event) into a registry. */
export function withEntries(registry: Registry, entries: RegistryEntry[]): Registry {
  const accounts = { ...registry.accounts };
  for (const e of entries) accounts[e.address] = e;
  return { ...registry, accounts };
}
