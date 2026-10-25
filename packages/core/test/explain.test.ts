import { describe, expect, it } from "vitest";
import { encode } from "xrpl";
import { decodeCurrency, explain } from "../src/index";

// "RLUSD" as a 160-bit hex currency code
const RLUSD_HEX = "524C555344" + "0".repeat(30);

// Valid, well-known special addresses (pass binary-codec encoding)
const ACCOUNT_ZERO = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";
const ACCOUNT_ONE = "rrrrrrrrrrrrrrrrrrrrBZbvji";

describe("decodeCurrency", () => {
  it("decodes standard and hex currency codes", () => {
    expect(decodeCurrency("USD")).toBe("USD");
    expect(decodeCurrency(RLUSD_HEX)).toBe("RLUSD");
  });
});

describe("explain: malicious TrustSet", () => {
  const scamTrustSet = {
    TransactionType: "TrustSet",
    Account: ACCOUNT_ZERO,
    Fee: "12",
    Sequence: 1,
    Flags: 0x00020000, // tfSetNoRipple
    LimitAmount: {
      currency: RLUSD_HEX,
      issuer: ACCOUNT_ONE, // NOT the canonical RLUSD issuer
      value: "1000000000",
    },
  };

  it("flags impersonation, unverified issuer, and unlimited limit", () => {
    const intent = explain(scamTrustSet);
    const codes = intent.warnings.map((w) => w.code);
    expect(codes).toContain("CURRENCY_IMPERSONATION");
    expect(codes).toContain("UNVERIFIED_ISSUER");
    expect(codes).toContain("UNLIMITED_TRUSTLINE");
    expect(intent.title).toBe("Set trustline");
  });

  it("round-trips through the binary codec (hex blob input)", () => {
    const blob = encode(scamTrustSet as any);
    const intent = explain(blob);
    expect(intent.txType).toBe("TrustSet");
    expect(intent.warnings.map((w) => w.code)).toContain("CURRENCY_IMPERSONATION");
  });
});

describe("explain: partial payment", () => {
  it("flags tfPartialPayment and the XRP→XRP malformation", () => {
    const intent = explain({
      TransactionType: "Payment",
      Account: ACCOUNT_ZERO,
      Destination: ACCOUNT_ONE,
      Amount: "1000000000",
      Flags: 0x00020000,
    });
    const codes = intent.warnings.map((w) => w.code);
    expect(codes).toContain("PARTIAL_PAYMENT");
    expect(codes).toContain("MALFORMED_PARTIAL_XRP");
  });

  it("does not flag a cross-currency partial payment as malformed", () => {
    const intent = explain({
      TransactionType: "Payment",
      Account: ACCOUNT_ZERO,
      Destination: ACCOUNT_ONE,
      Amount: { currency: RLUSD_HEX, issuer: ACCOUNT_ONE, value: "100" },
      SendMax: "120000000",
      Flags: 0x00020000,
    });
    const codes = intent.warnings.map((w) => w.code);
    expect(codes).toContain("PARTIAL_PAYMENT");
    expect(codes).not.toContain("MALFORMED_PARTIAL_XRP");
  });
});

describe("explain: Batch unfolds inner transactions", () => {
  it("renders inner intents and bubbles their warnings", () => {
    const intent = explain({
      TransactionType: "Batch",
      Account: ACCOUNT_ZERO,
      Flags: 0x00010000, // tfAllOrNothing
      RawTransactions: [
        {
          RawTransaction: {
            TransactionType: "Payment",
            Account: ACCOUNT_ZERO,
            Destination: ACCOUNT_ONE,
            Amount: "5000000",
            Flags: 0x00020000, // partial payment hidden inside a batch
          },
        },
        {
          RawTransaction: {
            TransactionType: "TrustSet",
            Account: ACCOUNT_ZERO,
            LimitAmount: { currency: RLUSD_HEX, issuer: ACCOUNT_ONE, value: "9999999999" },
          },
        },
      ],
    });
    expect(intent.inner?.length).toBe(2);
    const codes = intent.warnings.map((w) => w.code);
    expect(codes).toContain("BATCH_MULTI_EXECUTION");
    expect(codes).toContain("PARTIAL_PAYMENT");
    expect(codes).toContain("CURRENCY_IMPERSONATION");
  });
});

describe("explain: AMMDeposit", () => {
  const pool = {
    Asset: { currency: "XRP" },
    Asset2: { currency: RLUSD_HEX, issuer: ACCOUNT_ONE },
  };

  it("flags single-sided deposits without a bound", () => {
    const intent = explain({
      TransactionType: "AMMDeposit",
      Account: ACCOUNT_ZERO,
      ...pool,
      Amount: "100000000",
      Flags: 0x00080000, // tfSingleAsset
    });
    const codes = intent.warnings.map((w) => w.code);
    expect(codes).toContain("SINGLE_SIDED_DEPOSIT");
    expect(codes).toContain("NO_DEPOSIT_BOUND");
  });

  it("flags empty-pool seeding and missing mode flags", () => {
    const seeding = explain({
      TransactionType: "AMMDeposit",
      Account: ACCOUNT_ZERO,
      ...pool,
      Amount: "100000000",
      Amount2: { currency: RLUSD_HEX, issuer: ACCOUNT_ONE, value: "250" },
      Flags: 0x00800000, // tfTwoAssetIfEmpty
    });
    expect(seeding.warnings.map((w) => w.code)).toContain("POOL_SEEDING");

    const noMode = explain({ TransactionType: "AMMDeposit", Account: ACCOUNT_ZERO, ...pool, Amount: "1" });
    expect(noMode.warnings.map((w) => w.code)).toContain("AMM_MODE_INVALID");
  });
});

describe("explain: unknown type falls back safely", () => {
  it("renders raw fields with a warning", () => {
    const intent = explain({ TransactionType: "AMMBid", Account: ACCOUNT_ZERO, BidMax: "1000" });
    expect(intent.warnings.map((w) => w.code)).toContain("NO_DISPLAY_METADATA");
    expect(intent.fields.length).toBeGreaterThan(0);
  });
});

describe("display metadata documents", () => {
  it("renders TrustSet fields from its metadata document", () => {
    const intent = explain({
      TransactionType: "TrustSet",
      Account: ACCOUNT_ZERO,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: ACCOUNT_ONE, value: "1000000000" },
    });
    const field = (label: string) => intent.fields.find((f) => f.label === label);
    expect(field("Currency")?.value).toBe("RLUSD");
    expect(field("Issuer")?.risk).toBe("danger");
    expect(field("Limit")?.value).toBe("1000000000 (effectively unlimited)");
    expect(field("Flags")?.value).toBe("tfSetNoRipple");
    expect(intent.summary).toMatch(/^Trust up to 1000000000 RLUSD issued by .* unknown account\.$/);
  });

  it("does not warn on a verified issuer with a normal limit", () => {
    const intent = explain({
      TransactionType: "TrustSet",
      Account: ACCOUNT_ZERO,
      LimitAmount: { currency: RLUSD_HEX, issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", value: "1000" },
    });
    expect(intent.warnings).toEqual([]);
    expect(intent.fields.map((f) => f.label)).not.toContain("Flags");
  });

  it("supports a new transaction type with no code changes", () => {
    const intent = explain(
      { TransactionType: "SetRegularKey", Account: ACCOUNT_ZERO, RegularKey: ACCOUNT_ONE },
      {
        metadata: [
          {
            version: "0.1",
            txType: "SetRegularKey",
            title: "Set regular key",
            intent: "Let {RegularKey|account} sign for this account.",
            fields: [{ path: "RegularKey", label: "New key", format: "account", risks: ["KEY_HANDOVER"] }],
            risks: [
              {
                code: "KEY_HANDOVER",
                severity: "danger",
                when: { not: { missing: "RegularKey" } },
                message: "{RegularKey|address} gets full control of this account.",
              },
            ],
          },
        ],
      }
    );
    expect(intent.title).toBe("Set regular key");
    expect(intent.warnings.map((w) => w.code)).toEqual(["KEY_HANDOVER"]);
    expect(intent.fields[0].risk).toBe("danger");
  });

  it("rejects malformed documents at load time", () => {
    const bad = { version: "0.1", txType: "X", title: "X", intent: "X", fields: [], risks: [{ code: "R", severity: "warn", when: { eval: "1" }, message: "" }] };
    expect(() => explain({ TransactionType: "X" }, { metadata: [bad as any] })).toThrow(/condition/);
  });
});
