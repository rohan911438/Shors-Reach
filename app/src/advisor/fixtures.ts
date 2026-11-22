import type { Summary } from "./schema.js";

const zero = { EXPOSED_NOW: 0, EXPOSED_ON_SPEND: 0, PROTECTED: 0, UNKNOWN: 0 };

export const SUMMARIES: Record<string, Summary> = {
  satoshiEra: {
    score: 100,
    scoreBasis: "usd",
    totalsUsdRounded: { ...zero, EXPOSED_NOW: 6_500_000 },
    holdings: [
      { chain: "bitcoin", format: "p2pk", status: "EXPOSED_NOW", reason: "btc-p2pk-output", usdRounded: 5_000_000 },
      { chain: "bitcoin", format: "p2pkh", status: "EXPOSED_NOW", reason: "btc-sibling-key-revealed", usdRounded: 1_500_000 },
    ],
    questionnaire: { signedMessages: "unsure", custodial: false },
    qorechain: null,
  },
  evmActive: {
    score: 70,
    scoreBasis: "usd",
    totalsUsdRounded: { ...zero, EXPOSED_NOW: 21_000, UNKNOWN: 9_000 },
    holdings: [
      { chain: "ethereum", format: "eoa", status: "EXPOSED_NOW", reason: "evm-nonce-nonzero", usdRounded: 21_000 },
      { chain: "base", format: "eoa", status: "UNKNOWN", reason: "evm-offchain-signature-possible", usdRounded: 9_000 },
    ],
    questionnaire: { signedMessages: "unsure", custodial: false },
    qorechain: { pqKeyRegistered: false, windowLive: false },
  },
  careful: {
    score: 0,
    scoreBasis: "usd",
    totalsUsdRounded: { ...zero, EXPOSED_ON_SPEND: 3_000, PROTECTED: 70 },
    holdings: [
      { chain: "bitcoin", format: "p2wpkh", status: "EXPOSED_ON_SPEND", reason: "btc-hash-hidden", usdRounded: 3_000 },
      { chain: "qorechain", format: "qore-native", status: "PROTECTED", reason: "qore-native-pq-required", usdRounded: 70 },
    ],
    questionnaire: { signedMessages: "no", custodial: false },
    qorechain: { pqKeyRegistered: true, windowLive: false },
  },
};
