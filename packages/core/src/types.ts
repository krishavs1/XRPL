export type RiskSeverity = "info" | "warn" | "danger";

export interface RiskFlag {
  /** Stable machine-readable code, e.g. UNLIMITED_TRUSTLINE */
  code: string;
  severity: RiskSeverity;
  message: string;
}

export interface DisplayField {
  label: string;
  value: string;
  risk?: RiskSeverity;
  /** Raw address when the field is an account, so device profiles can apply the verified-name rule */
  account?: string;
}

/** The structured, wallet-agnostic output a signer UI (or device) renders. */
export interface DisplayIntent {
  txType: string;
  /** Short action name, e.g. "Set trustline" */
  title: string;
  /** One-sentence plain-language summary */
  summary: string;
  fields: DisplayField[];
  warnings: RiskFlag[];
  /** Nested intents (Batch inner transactions) */
  inner?: DisplayIntent[];
  raw: Record<string, unknown>;
}

export interface RegistryEntry {
  address: string;
  name: string;
  verified: boolean;
  kind?: "issuer" | "amm" | "exchange" | "service";
  /** Currency names this entry is the canonical issuer for (impersonation checks) */
  currencies?: string[];
  requiresDestinationTag?: boolean;
}

export interface Registry {
  network: string;
  accounts: Record<string, RegistryEntry>;
}

export interface RenderContext {
  registry: Registry;
  /** Injected by explain() so Batch can render inner transactions without import cycles */
  renderNested?: (tx: Record<string, any>) => DisplayIntent;
}

/** A structured risk condition: exactly one operator key per object. */
export type RiskWhen =
  | { not: RiskWhen }
  | { and: RiskWhen[] }
  | { or: RiskWhen[] }
  | { gte: [string, number] }
  | { eq: [string, string | number] }
  | { flag: string }
  | { missing: string }
  | { verified: string }
  | { impersonates: { currency: string; issuer: string } }
  | { requiresTag: string };

export interface MetadataField {
  path: string;
  label: string;
  format?: string;
  /** Risk codes that, when fired, mark this field (and append their `short` note) */
  risks?: string[];
  hideIfEmpty?: boolean;
}

export interface MetadataRisk {
  code: string;
  severity: RiskSeverity;
  when: RiskWhen;
  /** Template, e.g. "Issuer {LimitAmount.issuer|address} is not verified." */
  message: string;
  /** Short note appended to linked fields, e.g. "effectively unlimited" */
  short?: string;
}

/** One summary variant; the last one has no `when` and is the default. */
export interface MetadataIntent {
  when?: RiskWhen;
  text: string;
}

/** Display metadata document: one per transaction type (see spec). */
export interface MetadataDocument {
  version: string;
  txType: string;
  title: string;
  /** Summary template ("{path}" or "{path|format}"), or variants: the first whose `when` holds is used */
  intent: string | MetadataIntent[];
  flags?: Record<string, number>;
  /** Named value maps for the `enum:<name>` format, e.g. AccountSet's SetFlag numbers */
  enums?: Record<string, Record<string, string>>;
  fields: MetadataField[];
  risks?: MetadataRisk[];
}

export type Renderer =(tx: Record<string, any>, ctx: RenderContext) => DisplayIntent;
