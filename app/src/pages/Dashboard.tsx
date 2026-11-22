import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

import { CountUp } from "../components/ui.js";
import { CHAIN_BITS, CHAIN_LABEL, short, usd } from "../lib/format.js";
import { QORE_TESTNET_ID, usePassStats } from "../lib/passStats.js";
import { EXPLORER_TX } from "../pass/qorex.js";
import { usdBucketFloor } from "../pass/proof.js";
import { QUANTUM_PASS_ABI, QUANTUM_PASS_ADDRESS, QUANTUM_PASS_DEPLOY_BLOCK } from "../qore/quantumPass.js";

interface Minted {
  holder: string;
  scoreBucket: number;
  exposedUsdBucket: number;
  chainsMask: number;
  tx: string;
  block: bigint;
}

const PAGE = 5_000n;

function useRecentMints(limit = 12) {
  const client = usePublicClient({ chainId: QORE_TESTNET_ID });
  const [state, setState] = useState<{ items: Minted[]; loading: boolean; error?: string }>({ items: [], loading: true });
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const head = await client.getBlockNumber();
        const items: Minted[] = [];
        // Page backwards from the head until we have enough or reach the deploy block.
        for (let to = head; to >= QUANTUM_PASS_DEPLOY_BLOCK && items.length < limit; to -= PAGE) {
          const from = to - PAGE + 1n > QUANTUM_PASS_DEPLOY_BLOCK ? to - PAGE + 1n : QUANTUM_PASS_DEPLOY_BLOCK;
          const logs = await client.getContractEvents({ address: QUANTUM_PASS_ADDRESS, abi: QUANTUM_PASS_ABI, eventName: "PassMinted", fromBlock: from, toBlock: to });
          for (const l of logs.reverse()) {
            const a = l.args as { holder: string; scoreBucket: number; exposedUsdBucket: number; chainsMask: number };
            items.push({ holder: a.holder, scoreBucket: a.scoreBucket, exposedUsdBucket: a.exposedUsdBucket, chainsMask: a.chainsMask, tx: l.transactionHash, block: l.blockNumber });
          }
          if (cancelled) return;
        }
        if (!cancelled) setState({ items: items.slice(0, limit), loading: false });
      } catch (e) {
        if (!cancelled) setState({ items: [], loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, limit]);
  return state;
}

export function Dashboard() {
  const stats = usePassStats();
  const recent = useRecentMints();
  const maxScore = Math.max(1, ...(stats.scoreBuckets ?? [0]));
  const maxChain = Math.max(1, ...(stats.chainCounts ?? [0]));

  return (
    <>
      <header className="page-head">
        <a className="live-chip" href={`https://explore.qore.network/address/${QUANTUM_PASS_ADDRESS}`} target="_blank" rel="noreferrer">
          <span className="live-dot" /> Read live from QoreChain testnet
        </a>
        <h1>
          Who has moved under <em className="serif">post-quantum</em> protection
        </h1>
      </header>

      <div className="stats" style={{ marginTop: 20 }}>
        <div className="stat">
          <div className="num grad-text">
            <CountUp value={stats.totalPasses} />
          </div>
          <div className="lbl">Quantum Passes minted</div>
        </div>
        <div className="stat">
          <div className="num grad-text">
            <CountUp value={stats.attestedExposedUsdFloor} format={(n) => usd(n, { compact: true })} />+
          </div>
          <div className="lbl">exposed value attested (self-reported buckets, lower bound)</div>
        </div>
        <div className="stat">
          <div className="num">ML-DSA-87</div>
          <div className="lbl">key behind every pass, checked against the on-chain registry</div>
        </div>
        <div className="stat">
          <div className="num">0</div>
          <div className="lbl">addresses or amounts stored — buckets only</div>
        </div>
      </div>
      {stats.error && <div className="notice danger">Could not read the contract: {stats.error.message}</div>}

      <div className="grid-2" style={{ marginTop: 24 }}>
        <section className="card">
          <h3>Exposure score of pass holders (at scan time)</h3>
          <div className="bars">
            {(stats.scoreBuckets ?? Array(11).fill(0)).map((n, i) => (
              <div className="bar-row" key={i}>
                <span className="mono">{i === 10 ? "100" : `${i * 10}–${i * 10 + 9}`}</span>
                <div className="bar">
                  <span style={{ width: `${(100 * n) / maxScore}%`, background: "var(--grad)" }} />
                </div>
                <span className="mono" style={{ textAlign: "right" }}>
                  {n}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h3>Chains where holders had exposed keys</h3>
          <div className="bars">
            {CHAIN_BITS.map((c, i) => (
              <div className="bar-row" key={c}>
                <span>{CHAIN_LABEL[c]}</span>
                <div className="bar">
                  <span style={{ width: `${(100 * (stats.chainCounts?.[i] ?? 0)) / maxChain}%`, background: "var(--danger)" }} />
                </div>
                <span className="mono" style={{ textAlign: "right" }}>
                  {stats.chainCounts?.[i] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 24 }}>Latest passes</h2>
        {recent.loading ? (
          <div className="card">
            <div className="scanline" />
          </div>
        ) : recent.error ? (
          <div className="notice">Could not load events: {recent.error}</div>
        ) : recent.items.length === 0 ? (
          <p className="muted">
            No passes yet. <a href="#/pass">Be the first.</a>
          </p>
        ) : (
          <div className="table-wrap">
            <table className="holdings" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Holder</th>
                  <th>Score</th>
                  <th>Exposed</th>
                  <th>Chains</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {recent.items.map((m) => (
                  <tr key={m.tx}>
                    <td className="locator">{short(m.holder, 8, 6)}</td>
                    <td className="mono">{m.scoreBucket * 10}+</td>
                    <td className="mono">{m.exposedUsdBucket ? `${usd(usdBucketFloor(m.exposedUsdBucket), { compact: true })}+` : "—"}</td>
                    <td>{CHAIN_BITS.filter((_, i) => m.chainsMask & (1 << i)).map((c) => CHAIN_LABEL[c]).join(", ") || "—"}</td>
                    <td>
                      <a href={EXPLORER_TX(m.tx)} target="_blank" rel="noreferrer" className="mono">
                        {short(m.tx, 6, 4)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="faint" style={{ fontSize: 13, marginTop: 20 }}>
        Contract{" "}
        <a href={`https://explore.qore.network/address/${QUANTUM_PASS_ADDRESS}`} target="_blank" rel="noreferrer" className="mono">
          {QUANTUM_PASS_ADDRESS}
        </a>{" "}
        · counters are public view functions anyone can call · buckets are coarse and self-reported by design.
      </p>
    </>
  );
}
