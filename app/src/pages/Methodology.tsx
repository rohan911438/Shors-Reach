import { useEffect } from "react";

import { STATUS_LABEL } from "../lib/format.js";
import { REASONS, STATUSES, type ReasonCode } from "../scan/index.js";

const GROUPS: { title: string; codes: ReasonCode[] }[] = [
  {
    title: "Bitcoin",
    codes: ["btc-p2pk-output", "btc-taproot-output-key", "btc-key-revealed-by-spend", "btc-sibling-key-revealed", "btc-multisig-cosigner-revealed", "btc-hash-hidden"],
  },
  {
    title: "EVM chains",
    codes: [
      "evm-nonce-nonzero",
      "evm-nonce-other-chain",
      "evm-never-sent",
      "evm-offchain-signature-possible",
      "evm-contract-wallet-owner-exposed",
      "evm-contract-wallet-owners-hidden",
      "evm-contract-wallet-unknown",
    ],
  },
  { title: "QoreChain", codes: ["qore-pq-key-not-registered", "qore-native-pq-required", "qore-evm-window-open", "qore-params-not-enforced"] },
  { title: "Data quality", codes: ["source-unavailable"] },
];

const STATUS_TEXT: Record<string, string> = {
  EXPOSED_NOW: "The public key is on-chain. The coins can be attacked at any time (long-exposure). Always backed by an evidence link.",
  EXPOSED_ON_SPEND: "Only a hash of the key is on-chain. It is revealed when you spend, for the minutes your transaction waits to confirm (short-exposure).",
  PROTECTED: "Moving the funds requires a post-quantum signature (QoreChain native lane), or is bounded by a window you opened with one.",
  UNKNOWN: "We cannot tell — off-chain signatures, a failed data source, or missing evidence. Never shown as safe.",
};

export function Methodology({ anchor }: { anchor?: string }) {
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [anchor]);

  return (
    <article className="prose">
      <div className="eyebrow">Methodology</div>
      <h1 className="page-title">
        How Shor's Reach <em className="serif">decides</em>
      </h1>
      <p>
        Shor's algorithm turns an elliptic-curve <b>public key</b> into its private key. An address is only a hash of a key, so the question is never
        “which address?” but “has the key behind these coins ever been revealed — anywhere?”. Shor's Reach answers that question at the key level and
        attaches the on-chain transaction that proves each verdict.
      </p>

      <h2>The four verdicts</h2>
      {STATUSES.map((s) => (
        <p key={s}>
          <span className={`pill ${s}`}>{STATUS_LABEL[s]}</span> {STATUS_TEXT[s]}
        </p>
      ))}
      <p>
        <b>Score</b> = share of priced value that is Exposed now (0–100). Short-exposure and unknown amounts are shown separately, never mixed in.
      </p>

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2>{g.title} rules</h2>
          {g.codes.map((c) => (
            <div key={c} id={c} className="card reason-card">
              <h3 style={{ marginTop: 0 }}>{REASONS[c].title}</h3>
              <p style={{ marginBottom: 0 }}>{REASONS[c].detail}</p>
            </div>
          ))}
        </section>
      ))}

      <h2>Data sources</h2>
      <ul>
        <li>
          Bitcoin: <a href="https://mempool.space/docs/api/rest">mempool.space Esplora API</a> — address stats, transactions (public-key recovery from
          inputs) and script-hash lookups (pay-to-public-key outputs have no address).
        </li>
        <li>EVM: public RPC nodes (publicnode.com) for Ethereum, Base, Arbitrum, OP Mainnet, Polygon, BNB Chain and Avalanche.</li>
        <li>
          QoreChain testnet REST: <code>/qorechain/pqc/v1/params</code>, <code>/pqc/v1/account</code>, <code>/pqc/v1/evm_window</code>.
        </li>
        <li>Prices: CoinGecko. A missing price is shown as “—”, never as $0.</li>
      </ul>

      <h2>Privacy</h2>
      <ul>
        <li>The scan runs in your browser. Your input lives in the URL fragment (after #), which browsers never send to servers.</li>
        <li>xpubs are expanded locally; only derived addresses are queried. The xpub itself never leaves your device.</li>
        <li>The AI advisor receives an anonymised summary only: formats, verdicts and rounded USD — no addresses, transactions or exact amounts.</li>
        <li>We never ask for seed phrases or private keys. Anyone who does is not us.</li>
      </ul>

      <h2>Limits — read these</h2>
      <ul>
        <li>
          A key revealed <i>only</i> through a pay-to-public-key output whose address never spent cannot be found from the address alone (it needs a P2PK
          index). Paste the public key instead — that is how “Satoshi's genesis key” finds 50 BTC that his address doesn't show.
        </li>
        <li>Off-chain signatures are invisible on-chain → Unknown, refined by the questionnaire.</li>
        <li>Exchange and custodial addresses are reported, but their owners — not you — control the keys.</li>
        <li>HD-wallet scans follow a gap limit of 20 per chain, up to 200 addresses.</li>
        <li>Only native coins are valued (not tokens).</li>
        <li>
          Shor's Reach diagnoses. It never moves BTC or ETH. The Quantum Pass lives on QoreChain <b>testnet</b>; its buckets are self-reported and
          coarse by design.
        </li>
        <li>No one knows when a cryptographically relevant quantum computer will exist. Estimates vary widely; this tool shows exposure, not a date.</li>
      </ul>
    </article>
  );
}
