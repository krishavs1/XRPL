// Named fixtures for the demo dropdown. Replace issuer addresses with the
// testnet RLUSD issuer from the event booth where noted.

const RLUSD_HEX = "524C555344" + "0".repeat(30);
// Real, funded testnet accounts (protocol-reserved placeholder addresses like
// ACCOUNT_ONE fail rippled preflight, e.g. temDST_NEEDED on TrustSet).
const SCAM_ISSUER = "rapcCizU9u5EeaNT8rrzXESwbJcj5VUuKn";
const DEMO_RLUSD_ISSUER = "rFKWLRVzHatrpvFEvYv5xxVLsvuoXZppu"; // in the registry as the testnet demo issuer
/** Placeholder source account in fixtures; the app substitutes the connected device account. */
export const PLACEHOLDER_ACCOUNT = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";
const SOME_ACCOUNT = PLACEHOLDER_ACCOUNT;

export const samples: { name: string; tx: Record<string, unknown> }[] = [
  {
    name: "Scam trustline — impersonated RLUSD, unlimited limit",
    tx: {
      TransactionType: "TrustSet",
      Account: SOME_ACCOUNT,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: SCAM_ISSUER, value: "1000000000" },
    },
  },
  {
    name: "Legit RLUSD trustline",
    tx: {
      TransactionType: "TrustSet",
      Account: SOME_ACCOUNT,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: DEMO_RLUSD_ISSUER, value: "10000" },
    },
  },
  {
    name: "XRP payment — 15 XRP (clean, device-signable)",
    tx: {
      TransactionType: "Payment",
      Account: SOME_ACCOUNT,
      Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      Amount: "15000000",
    },
  },
  {
    name: "Partial payment (cross-currency) to an exchange, no destination tag",
    tx: {
      TransactionType: "Payment",
      Account: SOME_ACCOUNT,
      Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      Amount: { currency: RLUSD_HEX, issuer: DEMO_RLUSD_ISSUER, value: "100" },
      SendMax: "120000000",
      Flags: 0x00020000,
    },
  },
  {
    name: "Malformed — partial XRP-to-XRP payment (temBAD_SEND_XRP_PARTIAL)",
    tx: {
      TransactionType: "Payment",
      Account: SOME_ACCOUNT,
      Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      Amount: "1000000000",
      Flags: 0x00020000,
    },
  },
  {
    name: "DEX offer — sell 500 XRP for 1,250 RLUSD",
    tx: {
      TransactionType: "OfferCreate",
      Account: SOME_ACCOUNT,
      TakerGets: "500000000",
      TakerPays: { currency: RLUSD_HEX, issuer: DEMO_RLUSD_ISSUER, value: "1250" },
      Expiration: 847324800,
    },
  },
  {
    name: "AMM deposit — single-sided 100 XRP into XRP/RLUSD, no bound",
    tx: {
      TransactionType: "AMMDeposit",
      Account: SOME_ACCOUNT,
      Asset: { currency: "XRP" },
      Asset2: { currency: RLUSD_HEX, issuer: DEMO_RLUSD_ISSUER },
      Amount: "100000000",
      Flags: 0x00080000,
    },
  },
  {
    name: "Account takeover — SetRegularKey to an unknown key",
    tx: {
      TransactionType: "SetRegularKey",
      Account: SOME_ACCOUNT,
      RegularKey: SCAM_ISSUER,
    },
  },
  {
    name: "Account drain — AccountDelete to an unknown account",
    tx: {
      TransactionType: "AccountDelete",
      Account: SOME_ACCOUNT,
      Destination: SCAM_ISSUER,
    },
  },
  {
    name: "Batch — 2 inner transactions hidden behind one approval",
    tx: {
      TransactionType: "Batch",
      Account: SOME_ACCOUNT,
      Flags: 0x00010000,
      RawTransactions: [
        {
          RawTransaction: {
            TransactionType: "Payment",
            Account: SOME_ACCOUNT,
            Destination: SCAM_ISSUER,
            Amount: "5000000",
            Flags: 0x00020000,
          },
        },
        {
          RawTransaction: {
            TransactionType: "TrustSet",
            Account: SOME_ACCOUNT,
            LimitAmount: { currency: RLUSD_HEX, issuer: SCAM_ISSUER, value: "9999999999" },
          },
        },
      ],
    },
  },
];
