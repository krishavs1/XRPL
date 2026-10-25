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

describe("explain: unknown type falls back safely", () => {
  it("renders raw fields with a warning", () => {
    const intent = explain({ TransactionType: "AMMBid", Account: ACCOUNT_ZERO, BidMax: "1000" });
    expect(intent.warnings.map((w) => w.code)).toContain("NO_DISPLAY_METADATA");
    expect(intent.fields.length).toBeGreaterThan(0);
  });
});
