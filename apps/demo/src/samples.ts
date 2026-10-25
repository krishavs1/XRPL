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

export interface Sample {
  id: string;
  title: string;
  /** One line for the scenario card */
  blurb: string;
  tx: Record<string, unknown>;
}

export const samples: Sample[] = [
  {
    id: "scam-trustline",
    title: "Fake RLUSD trustline",
    blurb: "Trusts an \"RLUSD\" token from an impostor issuer, with an effectively unlimited limit.",
    tx: {
      TransactionType: "TrustSet",
      Account: SOME_ACCOUNT,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: SCAM_ISSUER, value: "1000000000" },
    },
  },
  {
    id: "real-trustline",
    title: "Real RLUSD trustline",
    blurb: "Trusts RLUSD from its verified issuer, with a normal limit.",
    tx: {
      TransactionType: "TrustSet",
      Account: SOME_ACCOUNT,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: DEMO_RLUSD_ISSUER, value: "10000" },
    },
  },
  {
    id: "xrp-payment",
    title: "Send 15 XRP",
    blurb: "A plain payment to an exchange, with the destination tag it requires.",
    tx: {
      TransactionType: "Payment",
      Account: SOME_ACCOUNT,
      Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      DestinationTag: 12345,
      Amount: "15000000",
    },
  },
  {
    id: "partial-payment",
    title: "Partial payment",
    blurb: "The recipient may get far less than the stated amount, and the exchange tag is missing.",
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
    id: "malformed-payment",
    title: "Malformed payment",
    blurb: "An XRP-to-XRP partial payment: the ledger rejects it, but a device would still sign it.",
    tx: {
      TransactionType: "Payment",
      Account: SOME_ACCOUNT,
      Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      Amount: "1000000000",
      Flags: 0x00020000,
    },
  },
  {
    id: "dex-offer",
    title: "DEX offer",
    blurb: "Sell 500 XRP for 1,250 RLUSD on the built-in exchange.",
    tx: {
      TransactionType: "OfferCreate",
      Account: SOME_ACCOUNT,
      TakerGets: "500000000",
      TakerPays: { currency: RLUSD_HEX, issuer: DEMO_RLUSD_ISSUER, value: "1250" },
      Expiration: 847324800,
    },
  },
  {
    id: "amm-deposit",
    title: "AMM deposit",
    blurb: "A single-sided 100 XRP deposit into an XRP/RLUSD pool, with no price bound.",
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
    id: "regular-key",
    title: "Account takeover",
    blurb: "Gives an unknown key full signing power over your account.",
    tx: {
      TransactionType: "SetRegularKey",
      Account: SOME_ACCOUNT,
      RegularKey: SCAM_ISSUER,
    },
  },
  {
    id: "account-delete",
    title: "Account drain",
    blurb: "Deletes your account and sends all of its XRP to an unknown address.",
    tx: {
      TransactionType: "AccountDelete",
      Account: SOME_ACCOUNT,
      Destination: SCAM_ISSUER,
    },
  },
  {
    id: "batch",
    title: "Batch: hidden transactions",
    blurb: "One signature, two inner transactions: a partial payment and a fake RLUSD trustline.",
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
