// Demo transactions. Replace issuer addresses with the testnet RLUSD issuer
// handed out at the Mastercard/Ripple booth where noted.

const RLUSD_HEX = "524C555344" + "0".repeat(30);
const CANONICAL_RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const SCAM_ISSUER = "rrrrrrrrrrrrrrrrrrrrBZbvji";
const SOME_ACCOUNT = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";

export const samples: { name: string; tx: Record<string, unknown> }[] = [
  {
    name: "😈 Scam TrustSet",
    tx: {
      TransactionType: "TrustSet",
      Account: SOME_ACCOUNT,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: SCAM_ISSUER, value: "1000000000" },
    },
  },
  {
    name: "✅ Legit RLUSD TrustSet",
    tx: {
      TransactionType: "TrustSet",
      Account: SOME_ACCOUNT,
      Flags: 0x00020000,
      LimitAmount: { currency: RLUSD_HEX, issuer: CANONICAL_RLUSD_ISSUER, value: "10000" },
    },
  },
  {
    name: "⚠️ Partial payment",
    tx: {
      TransactionType: "Payment",
      Account: SOME_ACCOUNT,
      Destination: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      Amount: "1000000000",
      Flags: 0x00020000,
    },
  },
  {
    name: "DEX offer",
    tx: {
      TransactionType: "OfferCreate",
      Account: SOME_ACCOUNT,
      TakerGets: "500000000",
      TakerPays: { currency: RLUSD_HEX, issuer: CANONICAL_RLUSD_ISSUER, value: "1250" },
      Expiration: 847324800,
    },
  },
  {
    name: "🕳️ Batch (hidden inner txs)",
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
