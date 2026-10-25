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

export type Renderer = (tx: Record<string, any>, ctx: RenderContext) => DisplayIntent;
