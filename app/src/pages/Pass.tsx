import { useEffect, useMemo, useState } from "react";

import { CHAIN_BITS, CHAIN_LABEL, short, uqorToQor, usd } from "../lib/format.js";
import { useScan, QORE_REST_PROXY } from "../lib/scanStore.js";
import { ShareCard } from "../components/ShareCard.js";
import { newSalt, passFieldsFromScan } from "../pass/fields.js";
import { usdBucketFloor } from "../pass/proof.js";
import { connectQorex, EXPLORER_TX, FAUCET_URL, qorex, sendProofTx } from "../pass/qorex.js";
import { QUANTUM_PASS_ADDRESS } from "../qore/quantumPass.js";

interface AccountStatus {
  pqKey: boolean;
  algorithm?: string;
  balanceUqor: bigint;
}

type Phase =
  | { k: "idle" }
  | { k: "busy"; msg: string }
  | { k: "error"; msg: string; hint?: "faucet" | "register" | "install" }
  | { k: "done"; nativeTx: string; evmTx: string; shield: string };

async function readStatus(addr: string): Promise<AccountStatus> {
  const [acc, bal] = await Promise.all([
    fetch(`${QORE_REST_PROXY}/qorechain/pqc/v1/account/${addr}`).then((r) => (r.ok ? r.json() : { found: false })),
    fetch(`${QORE_REST_PROXY}/cosmos/bank/v1beta1/balances/${addr}/by_denom?denom=uqor`).then((r) => (r.ok ? r.json() : {})) as Promise<{ balance?: { amount?: string } }>,
  ]);
  return {
    pqKey: Boolean(acc?.found && acc?.account?.public_key),
    algorithm: acc?.account?.algorithm_name,
    balanceUqor: BigInt(bal?.balance?.amount ?? "0"),
  };
}

export function Pass() {
  const s = useScan();
  const [addr, setAddr] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [salt] = useState(newSalt);
  const fields = useMemo(() => (s.result ? passFieldsFromScan(s.result, s.questionnaire, salt) : null), [s.result, s.questionnaire, salt]);
  const installed = typeof window !== "undefined" && qorex() !== null;

  const refresh = async (a: string) => {
    try {
      setStatus(await readStatus(a));
    } catch {
      setStatus(null);
    }
  };
  useEffect(() => {
    if (addr) void refresh(addr);
  }, [addr]);

  const connect = async () => {
    setPhase({ k: "busy", msg: "Waiting for QoreX…" });
    try {
      setAddr(await connectQorex());
      setPhase({ k: "idle" });
    } catch (e) {
      setPhase({ k: "error", msg: e instanceof Error ? e.message : String(e), hint: installed ? undefined : "install" });
    }
  };

  const mint = async () => {
    if (!addr || !fields) return;
    try {
      setPhase({ k: "busy", msg: "Approve the proof transaction in QoreX (1 uqor to yourself, hybrid-signed)…" });
      const tx = await sendProofTx(addr, fields);
      if (tx.code !== 0) throw new Error(`QoreChain rejected the transaction (code ${tx.code}).`);
      if (tx.shield === "downgraded") throw new Error("The transaction was committed WITHOUT the post-quantum layer. Not minting.");
      setPhase({ k: "busy", msg: "Proof committed. Minting your pass on QoreChain EVM…" });
      let res: Response | null = null;
      for (let i = 0; i < 5; i++) {
        res = await fetch("/api/attest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash: tx.txHash }) });
        if (res.status !== 404 && res.status !== 502) break; // 404: not indexed yet; 502: transient upstream error
        await new Promise((r) => setTimeout(r, 3000));
      }
      const body = (await res!.json()) as { evmTxHash?: string; error?: string; code?: string };
      if (!res!.ok) throw new Error(body.code === "already-minted" ? "You already hold a Quantum Pass — one per account." : (body.error ?? `HTTP ${res!.status}`));
      setPhase({ k: "done", nativeTx: tx.txHash, evmTx: body.evmTxHash!, shield: tx.shield });
      void refresh(addr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ k: "error", msg, hint: /insufficient|fee|balance/i.test(msg) ? "faucet" : undefined });
    }
  };

  const step = !s.result ? 1 : !addr ? 2 : !status?.pqKey ? 3 : phase.k === "done" ? 5 : 4;
  const cls = (n: number) => `s ${step === n ? "active" : step > n ? "done" : ""}`;
  const lowBalance = status !== null && status.balanceUqor < 50_000n;

  return (
    <>
      <div className="eyebrow">Quantum Pass · QoreChain testnet</div>
      <h1 style={{ fontSize: "clamp(30px,5vw,48px)" }}>Lock your account, then prove it.</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        A soulbound pass for accounts protected by a registered <b>ML-DSA-87</b> post-quantum key. Your proof is a QoreChain transaction that the chain
        only accepts with a hybrid secp256k1 + ML-DSA-87 signature. The pass records your scan's buckets — never your addresses.
      </p>

      <div className="stepper" style={{ marginTop: 24 }}>
        <div className={cls(1)}>
          <div className="badge">{step > 1 ? "✓" : 1}</div>
          <div>
            <h3>Scan</h3>
            {s.result ? (
              <p className="muted" style={{ margin: 0 }}>
                Score {s.result.score}/100 · exposed now {usd(s.result.totals.usd.EXPOSED_NOW, { compact: true })}
              </p>
            ) : (
              <>
                <p className="muted">The pass commits to a scan. Run one first (any address you control or follow).</p>
                <a className="btn primary" href="#/">
                  Start a scan
                </a>
              </>
            )}
          </div>
        </div>

        <div className={cls(2)}>
          <div className="badge">{step > 2 ? "✓" : 2}</div>
          <div>
            <h3>Connect QoreX</h3>
            {addr ? (
              <p className="muted mono" style={{ margin: 0 }}>
                {short(addr, 12, 8)}
                {status && ` · ${uqorToQor(status.balanceUqor)} QOR`}
              </p>
            ) : (
              <>
                <p className="muted">QoreX signs QoreChain transactions with your post-quantum key. Your key never leaves the wallet.</p>
                <button className="btn primary" type="button" disabled={step < 2 || phase.k === "busy"} onClick={connect}>
                  {installed ? "Connect QoreX" : "Connect QoreX (not detected)"}
                </button>
              </>
            )}
            {lowBalance && (
              <p className="notice" style={{ marginTop: 10 }}>
                Low balance. Get testnet QOR from the{" "}
                <a href={FAUCET_URL} target="_blank" rel="noreferrer">
                  faucet
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <div className={cls(3)}>
          <div className="badge">{step > 3 ? "✓" : 3}</div>
          <div>
            <h3>Post-quantum key registered</h3>
            {status?.pqKey ? (
              <p className="muted" style={{ margin: 0 }}>
                {status.algorithm ?? "ML-DSA-87"} key on-chain. Breaking ECDSA alone can no longer move this account's native funds.
              </p>
            ) : (
              <>
                <p className="muted">
                  Not yet. Until you register, whoever breaks your ECDSA key first can register <i>their</i> key and take the account. Registration is
                  done inside QoreX (one time — a second, different key is refused).
                </p>
                {addr && (
                  <button className="btn small" type="button" onClick={() => void refresh(addr)}>
                    I registered — check again
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className={cls(4)}>
          <div className="badge">{step > 4 ? "✓" : 4}</div>
          <div>
            <h3>Sign your proof &amp; mint</h3>
            {fields && (
              <dl className="kv" style={{ margin: "6px 0 12px" }}>
                <dt>Score bucket</dt>
                <dd>
                  {fields.scoreBucket * 10}–{fields.scoreBucket === 10 ? 100 : fields.scoreBucket * 10 + 9}
                </dd>
                <dt>Exposed value</dt>
                <dd>{fields.exposedUsdBucket === 0 ? "none" : `${usd(usdBucketFloor(fields.exposedUsdBucket), { compact: true })}+`}</dd>
                <dt>Chains</dt>
                <dd>
                  {CHAIN_BITS.filter((_, i) => fields.chainsMask & (1 << i))
                    .map((c) => CHAIN_LABEL[c])
                    .join(", ") || "none"}
                </dd>
                <dt>Scan hash</dt>
                <dd title="keccak256(anonymised summary + a secret salt kept in this tab)">{short(fields.scanHash, 10, 8)}</dd>
              </dl>
            )}
            <button className="btn primary" type="button" disabled={step !== 4 || phase.k === "busy"} onClick={mint}>
              Sign proof &amp; mint pass
            </button>
          </div>
        </div>

        <div className={cls(5)}>
          <div className="badge">5</div>
          <div>
            <h3>Done</h3>
            {phase.k === "done" ? (
              <div>
                <p className="muted">Your Quantum Pass is minted and cannot be transferred.</p>
                <div className="tx">
                  Proof (hybrid-signed, {phase.shield}):{" "}
                  <a href={EXPLORER_TX(phase.nativeTx)} target="_blank" rel="noreferrer">
                    {short(phase.nativeTx, 10, 8)}
                  </a>
                </div>
                <div className="tx">
                  Mint:{" "}
                  <a href={EXPLORER_TX(phase.evmTx)} target="_blank" rel="noreferrer">
                    {short(phase.evmTx, 10, 8)}
                  </a>
                </div>
                <a className="btn" href="#/dashboard" style={{ marginTop: 12 }}>
                  See the public counter →
                </a>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Contract{" "}
                <a href={`https://explore.qore.network/address/${QUANTUM_PASS_ADDRESS}`} target="_blank" rel="noreferrer" className="mono">
                  {short(QUANTUM_PASS_ADDRESS, 8, 6)}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      {phase.k === "done" && s.result && <ShareCard score={s.result.score} exposedUsd={s.result.totals.usd.EXPOSED_NOW} protectedOnQore />}

      {phase.k === "busy" && (
        <div className="notice info" style={{ marginTop: 16 }} aria-live="polite">
          {phase.msg}
        </div>
      )}
      {phase.k === "error" && (
        <div className="notice danger" style={{ marginTop: 16 }} role="alert">
          {phase.msg}{" "}
          {phase.hint === "faucet" && (
            <a href={FAUCET_URL} target="_blank" rel="noreferrer">
              Get testnet QOR →
            </a>
          )}
          {phase.hint === "install" && (
            <a href="https://www.qorechain.io" target="_blank" rel="noreferrer">
              Get QoreX →
            </a>
          )}
        </div>
      )}

      <details className="card" style={{ marginTop: 24 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>How the proof works (and the self-mint path)</summary>
        <div className="muted" style={{ marginTop: 10 }}>
          <p>
            QoreX currently signs only native QoreChain transactions, and it always adds the ML-DSA-87 layer. Your proof sends 1 uqor to yourself with
            a memo committing to the pass fields. Our attester checks that committed transaction (success, PQC extension present, memo, sender) and calls{" "}
            <code>attest()</code>; the contract re-reads your key from the PQC registry precompile (<code>0x…0a02</code>), binds the pass to it, and
            burns the proof so it cannot be reused.
          </p>
          <p style={{ marginBottom: 0 }}>
            Accounts that can sign EVM transactions call <code>mint()</code> directly with an ML-DSA-87 signature, verified fully on-chain by the{" "}
            <code>pqcVerify</code> precompile (<code>0x…0a01</code>) — no attester involved. See <code>contracts/scripts/deploy-pass.ts</code>.
          </p>
        </div>
      </details>
    </>
  );
}
