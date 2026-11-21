import type { ReasonCode } from "../types.js";

export interface ReasonText {
  title: string;
  oneLiner: string;
  /** Longer explanation for the methodology page / "Why?" drawer. */
  detail: string;
}

export const REASONS: Record<ReasonCode, ReasonText> = {
  "btc-p2pk-output": {
    title: "Pay-to-public-key output",
    oneLiner: "The public key is written directly in the output.",
    detail:
      "Early Bitcoin (including Satoshi-era coinbase rewards) paid coins straight to a public key (P2PK). There is no hash protecting it: the key has been public since the coins arrived, and Shor's algorithm turns a public key into its private key. These outputs have no address, so address-level scanners never see them.",
  },
  "btc-taproot-output-key": {
    title: "Taproot output key",
    oneLiner: "Taproot puts a 32-byte public key in every output.",
    detail:
      "A Taproot (bc1p…) output commits to an x-only public key, not a hash (BIP-341). The key is public from the moment coins arrive. Breaking it gives the tweaked private key, which can spend the coins via the key path. The newest address type is therefore the most exposed at rest. BIP-360 (P2MR) proposes to fix this but is still a draft.",
  },
  "btc-key-revealed-by-spend": {
    title: "Key revealed by an earlier spend",
    oneLiner: "This address has spent before; the spend published its public key.",
    detail:
      "Hash-based addresses (1…, 3…, bc1q…) hide the key until you spend. Spending publishes the key in the input. Coins still held — or received later — by the same address are then protected only by the elliptic-curve problem. Address reuse is the single biggest source of exposed bitcoin (~4.3M BTC, Glassnode Oct 2026).",
  },
  "btc-sibling-key-revealed": {
    title: "Same key, different address format",
    oneLiner: "The same key was revealed through another of its address formats.",
    detail:
      "One key controls several formats at once: legacy 1… (compressed and uncompressed), native SegWit bc1q…, nested SegWit 3…, P2PK and Taproot. A spend from any of them reveals the key for all of them. Shor's Reach derives every form from the revealed key and checks each one.",
  },
  "btc-multisig-cosigner-revealed": {
    title: "Multisig keys revealed",
    oneLiner: "A spend from this script published every cosigner key.",
    detail:
      "Spending from a P2SH or P2WSH script reveals the full script, including all cosigner public keys. An attacker who can break secp256k1 can derive enough of them to meet the threshold. Coins still in the same script are exposed.",
  },
  "btc-hash-hidden": {
    title: "Key hidden behind a hash",
    oneLiner: "Not exposed at rest — but the key appears when you spend.",
    detail:
      "This address has never spent, so only a hash of the key is on-chain. A quantum attacker would have to break the key during the ~10 minutes your spending transaction waits in the mempool (short-exposure), which needs a far faster machine. Avoid reusing the address after spending.",
  },
  "evm-nonce-nonzero": {
    title: "Account has sent transactions",
    oneLiner: "Every signed transaction lets anyone recover the public key.",
    detail:
      "EVM signatures allow public-key recovery (ecrecover). Once an account has sent a single transaction, its key is public forever. ethereum.org: 'when an account sends a transaction, its public key is exposed onchain'.",
  },
  "evm-nonce-other-chain": {
    title: "Key exposed on another EVM chain",
    oneLiner: "One transaction on any EVM chain exposes this balance too.",
    detail:
      "Your address is the same on every EVM chain because the same private key controls it. A transaction on Base, Arbitrum or any other chain reveals the key that also guards your Ethereum balance — even if you never sent anything on Ethereum.",
  },
  "evm-never-sent": {
    title: "Never sent a transaction",
    oneLiner: "Only the address hash is on-chain — until you send.",
    detail:
      "No chain we checked has a transaction from this account, and you told us you have never signed messages with it. Its key is hidden until the first transaction (short-exposure, ~12 s on Ethereum).",
  },
  "evm-offchain-signature-possible": {
    title: "Off-chain signatures can't be seen",
    oneLiner: "Signed permits, 'Sign in with…' and messages also reveal the key.",
    detail:
      "Any signature — including off-chain ones like EIP-712 permits, Sign-In-With-Ethereum or personal_sign — lets the receiver recover your public key. These never appear on-chain, so we mark the account UNKNOWN rather than safe. Answer the questionnaire to refine this.",
  },
  "evm-contract-wallet-owner-exposed": {
    title: "Smart-wallet owner exposed",
    oneLiner: "The wallet is controlled by an owner key that is public.",
    detail:
      "A smart-contract wallet (e.g. Safe) is only as strong as the ECDSA keys of its owners. At least one owner key has signed a transaction, so it is public.",
  },
  "evm-contract-wallet-owners-hidden": {
    title: "Smart-wallet owners hidden",
    oneLiner: "No owner key of this wallet has been revealed on-chain.",
    detail: "Every owner of this contract wallet has nonce 0 on the chains we checked. Their keys are hidden until they sign.",
  },
  "evm-contract-wallet-unknown": {
    title: "Unknown contract wallet",
    oneLiner: "We couldn't determine who controls this contract.",
    detail: "The address holds code that is not a recognised Safe-style wallet, so its controlling keys are unknown.",
  },
  "qore-pq-key-not-registered": {
    title: "No post-quantum key registered",
    oneLiner: "Until you register, whoever breaks your ECDSA key can claim this account.",
    detail:
      "QoreChain requires an ML-DSA-87 signature on every native transaction — but the first key registration is the one transaction accepted with a classical signature alone. An account without a registered key is therefore as weak as an Ethereum account: an attacker who breaks the ECDSA key can register their own post-quantum key first. Registering early is the real protection.",
  },
  "qore-native-pq-required": {
    title: "Post-quantum signature required",
    oneLiner: "Every native transaction needs your ML-DSA-87 signature.",
    detail:
      "This account has a registered ML-DSA-87 key and the chain enforces hybrid signatures (hybrid_signature_mode: required, allow_classical_fallback: false). Breaking the ECDSA key alone cannot move funds.",
  },
  "qore-evm-window-open": {
    title: "EVM window open",
    oneLiner: "Protected — but secp256k1-only EVM transactions are admitted within the window's limits.",
    detail:
      "EVM transactions on QoreChain are signed with secp256k1 only, so the chain admits them only inside a window opened with a post-quantum signature. While it is open, an attacker who broke the ECDSA key could spend up to the window's remaining value. Keep windows short and scoped to the contracts you use.",
  },
  "qore-params-not-enforced": {
    title: "Hybrid signatures not confirmed",
    oneLiner: "We could not confirm the chain enforces post-quantum signatures.",
    detail: "The chain parameters did not report hybrid_signature_mode 'required' with classical fallback disabled, so we do not assume protection.",
  },
  "source-unavailable": {
    title: "Data source unavailable",
    oneLiner: "We couldn't read this — so we won't call it safe.",
    detail: "A data source failed or timed out, or a verdict lacked on-chain evidence. Shor's Reach never reports a holding as safe without data.",
  },
};
