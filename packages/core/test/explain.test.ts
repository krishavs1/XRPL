import { describe, expect, it } from "vitest";
import { encode } from "xrpl";
import { decodeCurrency, defaultRegistry, explain, toDeviceScreens, truncateMiddle, withEntries } from "../src/index";

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
      { TransactionType: "Clawback", Account: ACCOUNT_ZERO, Amount: { currency: "USD", issuer: ACCOUNT_ONE, value: "50" } },
      {
        metadata: [
          {
            version: "0.1",
            txType: "Clawback",
            title: "Claw back tokens",
            intent: "Take back {Amount.value} {Amount.currency|currency} from {Amount.issuer|account}.",
            fields: [{ path: "Amount.issuer", label: "From", format: "account", risks: ["TOKEN_CLAWBACK"] }],
            risks: [
              {
                code: "TOKEN_CLAWBACK",
                severity: "danger",
                when: { not: { missing: "Amount" } },
                message: "{Amount.issuer|address} loses {Amount.value} {Amount.currency|currency}.",
              },
            ],
          },
        ],
      }
    );
    expect(intent.title).toBe("Claw back tokens");
    expect(intent.warnings.map((w) => w.code)).toEqual(["TOKEN_CLAWBACK"]);
    expect(intent.fields[0].risk).toBe("danger");
  });

  it("rejects malformed documents at load time", () => {
    const bad = { version: "0.1", txType: "X", title: "X", intent: "X", fields: [], risks: [{ code: "R", severity: "warn", when: { eval: "1" }, message: "" }] };
    expect(() => explain({ TransactionType: "X" }, { metadata: [bad as any] })).toThrow(/condition/);
    const badEnum = { version: "0.1", txType: "X", title: "X", intent: "{SetFlag|enum:nope}", fields: [] };
    expect(() => explain({ TransactionType: "X" }, { metadata: [badEnum as any] })).toThrow(/format/);
    const noDefault = { version: "0.1", txType: "X", title: "X", intent: [{ when: { missing: "A" }, text: "X" }], fields: [] };
    expect(() => explain({ TransactionType: "X" }, { metadata: [noDefault as any] })).toThrow(/intent/);
  });
});

describe("account-takeover types (metadata documents)", () => {
  const codes = (tx: object) => explain(tx).warnings.map((w) => `${w.severity}:${w.code}`);

  it("SetRegularKey: handing over the key is danger, removing it is info", () => {
    const intent = explain({ TransactionType: "SetRegularKey", Account: ACCOUNT_ZERO, RegularKey: ACCOUNT_ONE });
    expect(intent.warnings.map((w) => w.code)).toEqual(["REGULAR_KEY_CHANGE"]);
    expect(intent.fields[0]).toMatchObject({ label: "New key", risk: "danger", account: ACCOUNT_ONE });
    const removed = explain({ TransactionType: "SetRegularKey", Account: ACCOUNT_ZERO });
    expect(removed.summary).toMatch(/^Remove the regular key/);
    expect(codes({ TransactionType: "SetRegularKey", Account: ACCOUNT_ZERO })).toEqual(["info:REGULAR_KEY_REMOVED"]);
  });

  it("SignerListSet: each signer is its own account field, through the binary codec", () => {
    const tx = {
      TransactionType: "SignerListSet",
      Account: ACCOUNT_ZERO,
      Fee: "12",
      Sequence: 1,
      SignerQuorum: 2,
      SignerEntries: [
        { SignerEntry: { Account: ACCOUNT_ONE, SignerWeight: 1 } },
        { SignerEntry: { Account: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", SignerWeight: 1 } },
      ],
    };
    const intent = explain(encode(tx as any));
    expect(intent.warnings.map((w) => w.code)).toEqual(["SIGNER_LIST_CHANGE"]);
    expect(intent.fields.map((f) => f.label)).toEqual(["Quorum", "Signer 1", "Signer 2", "Weights"]);
    const screens = toDeviceScreens(intent, defaultRegistry).map((s) => s.body);
    expect(screens).toContain("rrrrrrr…Zbvji · unverified");
    expect(screens).toContain("Bitstamp ✓ · rvYAfWj…bs59B");
    expect(codes({ TransactionType: "SignerListSet", Account: ACCOUNT_ZERO, SignerQuorum: 0 })).toEqual(["info:SIGNER_LIST_REMOVED"]);
  });

  it("AccountSet: disabling the master key is danger; ordinary settings are quiet", () => {
    const intent = explain({ TransactionType: "AccountSet", Account: ACCOUNT_ZERO, SetFlag: 4 });
    expect(intent.summary).toMatch(/^Disable the master key/);
    expect(intent.fields[0].value).toBe("Disable master key (you may lose access)");
    expect(intent.warnings.map((w) => w.code)).toEqual(["MASTER_KEY_DISABLED"]);
    const benign = explain({ TransactionType: "AccountSet", Account: ACCOUNT_ZERO, ClearFlag: 9, Domain: "6578616D706C652E636F6D" });
    expect(benign.warnings).toEqual([]);
    expect(benign.summary).toMatch(/^Turn off "Deposit authorization"/);
    expect(benign.fields.find((f) => f.label === "Domain")?.value).toBe("example.com");
  });

  it("AccountDelete: always danger, plus destination checks", () => {
    expect(codes({ TransactionType: "AccountDelete", Account: ACCOUNT_ZERO, Destination: ACCOUNT_ONE })).toEqual([
      "danger:ACCOUNT_DELETION",
      "warn:UNVERIFIED_DESTINATION",
    ]);
    expect(codes({ TransactionType: "AccountDelete", Account: ACCOUNT_ZERO, Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B" })).toEqual([
      "danger:ACCOUNT_DELETION",
      "warn:MISSING_DESTINATION_TAG",
    ]);
  });
});

describe("device profile", () => {
  const scam = {
    TransactionType: "TrustSet",
    Account: ACCOUNT_ZERO,
    LimitAmount: { currency: RLUSD_HEX, issuer: ACCOUNT_ONE, value: "1000000000" },
  };
  const legit = {
    TransactionType: "TrustSet",
    Account: ACCOUNT_ZERO,
    LimitAmount: { currency: RLUSD_HEX, issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", value: "1000" },
  };

  it("renders danger warnings before anything else and asks to reject", () => {
    const screens = toDeviceScreens(explain(scam), defaultRegistry);
    expect(screens.slice(0, 3).map((s) => s.kind)).toEqual(["warning", "warning", "warning"]);
    expect(screens[0].severity).toBe("danger");
    expect(screens.at(-1)).toMatchObject({ kind: "approve", heading: "Reject recommended" });
  });

  it("looks different for a safe transaction: no warnings, plain approval", () => {
    const screens = toDeviceScreens(explain(legit), defaultRegistry);
    expect(screens[0].kind).toBe("title");
    expect(screens.some((s) => s.kind === "warning")).toBe(false);
    expect(screens.at(-1)?.heading).toBe("Sign transaction?");
    expect(screens.find((s) => s.heading === "Issuer")?.body).toBe("Ripple (RLUSD) ✓ · rMxCKbE…8m5De");
  });

  it("never shows an unverified registry name", () => {
    const registry = withEntries(defaultRegistry, [
      { address: ACCOUNT_ONE, name: "Ripple Official", verified: false },
    ]);
    const screens = toDeviceScreens(explain(scam, { registry }), registry);
    const issuer = screens.find((s) => s.heading === "Issuer")!;
    expect(issuer.body).not.toContain("Ripple Official");
    expect(issuer.body).toContain("unverified");
  });

  it("unfolds Batch inner transactions into their own screens", () => {
    const batch = {
      TransactionType: "Batch",
      Account: ACCOUNT_ZERO,
      Flags: 0x00010000,
      RawTransactions: [{ RawTransaction: scam }, { RawTransaction: legit }],
    };
    const headings = toDeviceScreens(explain(batch), defaultRegistry).map((s) => s.heading);
    expect(headings).toContain("#1 Issuer");
    expect(headings).toContain("#2 Issuer");
    expect(headings[0]).toBe("BATCH_MULTI_EXECUTION");
  });

  it("truncates long values middle-out", () => {
    expect(truncateMiddle("abcdefghijklmnopqrstuvwxyz", 11)).toBe("abcde…vwxyz");
    expect(truncateMiddle("short", 11)).toBe("short");
  });
});
