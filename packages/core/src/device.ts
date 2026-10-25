import type { DisplayIntent, Registry, RiskSeverity } from "./types";
import { truncateAddress } from "./format";

/**
 * Device profile (spec: "Device profile"): turns a DisplayIntent into the
 * ordered screens a signing device's secure screen shows.
 *
 * - `danger` risks render first, before the title and any field, so a risky
 *   transaction never looks like a safe one;
 * - fields render in metadata order, with long values truncated middle-out;
 * - an account renders its registry name only with the verified mark;
 * - the final screen asks for a reject-by-default approval when any danger
 *   risk fired.
 */

export interface DeviceScreen {
  kind: "warning" | "title" | "field" | "approve";
  severity?: RiskSeverity;
  heading: string;
  body: string;
}

export interface DeviceProfileOptions {
  /** Max characters of a field value on one screen (default 40, roughly a Stax/Flex screen). */
  maxChars?: number;
}

/** Keep the start and end of a long string, which are what users compare. */
export function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  return `${s.slice(0, head)}…${s.slice(s.length - (keep - head))}`;
}

function accountForDevice(address: string, registry: Registry): string {
  const entry = registry.accounts[address];
  // An unverified registry name is attacker-controllable text: never show it.
  if (entry?.verified) return `${entry.name} ✓ · ${truncateAddress(address)}`;
  return `${truncateAddress(address)} · unverified`;
}

function screensFor(intent: DisplayIntent, registry: Registry, max: number, prefix = ""): DeviceScreen[] {
  const screens: DeviceScreen[] = [{ kind: "title", heading: `${prefix}Review`, body: intent.title }];
  for (const f of intent.fields) {
    // Batch summary rows are replaced by the inner transactions' own screens
    if (intent.inner?.length && /^#\d+ /.test(f.label)) continue;
    const value = f.account ? accountForDevice(f.account, registry) : truncateMiddle(f.value, max);
    screens.push({ kind: "field", heading: `${prefix}${f.label}`, body: value, severity: f.risk });
  }
  intent.inner?.forEach((inner, i) => {
    screens.push(...screensFor(inner, registry, max, `${prefix}#${i + 1} `));
  });
  return screens;
}

export function toDeviceScreens(
  intent: DisplayIntent,
  registry: Registry,
  opts: DeviceProfileOptions = {}
): DeviceScreen[] {
  const max = opts.maxChars ?? 40;
  const warning = (w: DisplayIntent["warnings"][number]): DeviceScreen => ({
    kind: "warning",
    severity: w.severity,
    heading: w.code,
    body: w.message,
  });
  const dangers = intent.warnings.filter((w) => w.severity === "danger");
  const others = intent.warnings.filter((w) => w.severity !== "danger");

  return [
    ...dangers.map(warning),
    ...screensFor(intent, registry, max),
    ...others.map(warning),
    dangers.length
      ? {
          kind: "approve",
          severity: "danger",
          heading: "Reject recommended",
          body: `${dangers.length} danger warning${dangers.length === 1 ? "" : "s"}. Hold to sign anyway.`,
        }
      : { kind: "approve", heading: "Sign transaction?", body: "Hold to sign." },
  ];
}
