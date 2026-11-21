/**
 * Deterministic rule-based plan. Used when no API key is configured, the API fails, or its output is invalid —
 * so the product never breaks. Same input → same output.
 */
import type { Plan, Summary } from "./schema.js";

const fmtUsd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${Math.round(n)}`;

export function fallbackPlan(s: Summary): Plan {
  const h = s.holdings;
  const has = (pred: (x: Summary["holdings"][number]) => boolean) => h.some(pred);
  const exposedBtc = has((x) => x.chain === "bitcoin" && x.status === "EXPOSED_NOW");
  const taproot = has((x) => x.format === "p2tr" && x.status === "EXPOSED_NOW");
  const p2pk = has((x) => x.format === "p2pk");
  const reused = has((x) => x.reason === "btc-key-revealed-by-spend" || x.reason === "btc-sibling-key-revealed");
  const multisig = has((x) => x.reason === "btc-multisig-cosigner-revealed");
  const hiddenBtc = has((x) => x.chain === "bitcoin" && x.status === "EXPOSED_ON_SPEND");
  const evmExposed = has((x) => x.chain !== "bitcoin" && !x.chain.startsWith("qorechain") && x.status === "EXPOSED_NOW");
  const evmUnknown = has((x) => x.reason === "evm-offchain-signature-possible");
  const smartWallet = has((x) => x.format === "safe" || x.reason.startsWith("evm-contract-wallet"));
  const q = s.qorechain;

  const actions: Plan["actions"] = [];
  const push = (title: string, why: string, how: string) => actions.push({ priority: actions.length + 1, title, why, how });

  if (exposedBtc) {
    push(
      "Move Bitcoin off outputs whose public key is already on-chain",
      `About ${fmtUsd(s.totalsUsdRounded.EXPOSED_NOW)} sits behind keys anyone can read today. A future quantum computer could attack them at leisure — no race against a pending transaction.`,
      "Send these coins to a fresh, never-used native SegWit (bc1q…) address from your wallet, one you have never received to or spent from before. Test with a small amount first.",
    );
  }
  if (taproot)
    push(
      "Treat Taproot as exposed at rest",
      "Taproot (bc1p…) outputs contain the public key itself, so they are exposed from the moment they receive coins.",
      "For long-term storage prefer a fresh native SegWit address until a post-quantum output type ships. BIP-360 is still a draft.",
    );
  if (p2pk)
    push(
      "Pay-to-public-key coins are the most exposed",
      "These early-style outputs publish the raw key — they are the first coins an attacker would target.",
      "If they are yours, move them to a fresh hash-based address. If they belong to someone else, there is nothing to do but know they exist.",
    );
  if (multisig)
    push(
      "Rotate multisig co-signer keys",
      "Spending from a multisig reveals every co-signer key in the script.",
      "Create a new multisig with fresh keys and move funds there; avoid reusing the same script after each spend.",
    );
  if (evmExposed)
    push(
      "Know that one EVM transaction exposes the key on every chain",
      "Ethereum-style chains share the same key. Once an account has sent a transaction anywhere, its public key is recoverable everywhere.",
      "For long-term savings, a fresh never-used account keeps its key hidden until its first transaction. Smart-account and post-quantum account options are emerging; follow your wallet's guidance.",
    );
  if (smartWallet)
    push(
      "Check the owners of your smart wallet",
      "A smart wallet is only as safe as the keys of its owners.",
      "Review the owner list; prefer owners that have never sent a transaction, and plan to rotate them as post-quantum options arrive.",
    );
  if (q && !q.pqKeyRegistered)
    push(
      "Register a post-quantum key on your QoreChain account",
      "Until you do, the first registration only needs a classical signature — whoever breaks this ECDSA key first could register their own key and take the account.",
      "Open the Quantum Pass page and register your ML-DSA-87 key with your QoreX wallet. It is a one-time step.",
    );
  if (q?.windowLive)
    push(
      "Close or shrink your QoreChain EVM window when you don't need it",
      "While a window is open, classical EVM transactions are allowed within its limits.",
      "Open windows only right before EVM activity, with a small transaction and value cap.",
    );
  if (actions.length === 0)
    push(
      "Keep keys hidden by avoiding address reuse",
      "Nothing here is exposed at rest right now. Keys stay hidden only while each address is used to receive once and spend once.",
      "Always use a fresh receive address; spend whole outputs to a new change address; avoid signing unnecessary messages.",
    );

  const stopDoing: string[] = [];
  if (reused || exposedBtc) stopDoing.push("Reusing Bitcoin addresses after you have spent from them.");
  if (evmUnknown || s.questionnaire.signedMessages !== "no") stopDoing.push("Signing messages, permits or “Sign in with…” requests from savings accounts.");
  stopDoing.push("Sharing a seed phrase or private key with anyone — no legitimate tool, including this one, will ever ask.");

  const unknowns: string[] = [];
  if (evmUnknown) unknowns.push("Off-chain signatures never appear on-chain, so we cannot see whether this key signed one.");
  if (s.totalsUsdRounded.UNKNOWN > 0 || has((x) => x.status === "UNKNOWN"))
    unknowns.push("Some holdings could not be checked (a data source failed or evidence was missing) — they are not counted as safe.");
  if (hiddenBtc) unknowns.push("Hash-only Bitcoin outputs are exposed briefly while a spend is in the mempool; how much that matters depends on how fast future attacks become.");
  unknowns.push("Nobody knows when a cryptographically relevant quantum computer will exist; estimates vary widely.");

  const summary =
    s.score > 0
      ? `About ${s.score}% of what we could value is behind public keys already visible on-chain. Nothing is lost today, but these are the first coins a quantum attacker would target, and moving them is straightforward.`
      : "Nothing we found is exposed at rest right now. The plan below keeps it that way.";

  return {
    summary,
    actions: actions.slice(0, 6),
    stopDoing: stopDoing.slice(0, 5),
    unknowns: unknowns.slice(0, 5),
    qorechainNote:
      "QoreChain requires a hybrid secp256k1 + ML-DSA-87 signature on every native transaction, so breaking ECDSA alone moves nothing there. It is one option available today, on testnet — not a recommendation to buy anything.",
  };
}
