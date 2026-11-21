import { Fragment, useEffect, useState } from "react";

import { ScanInput } from "../components/ScanInput.js";
import { amount, CHAIN_LABEL, FORMAT_LABEL, short, STATUS_COLOR, STATUS_LABEL, uqorToQor, usd } from "../lib/format.js";
import { href } from "../lib/router.js";
import { useScan } from "../lib/scanStore.js";
import { REASONS, STATUSES, type Holding, type Questionnaire, type ScanResult, type Status } from "../scan/index.js";

export function ScanPage({ input }: { input: string }) {
  const s = useScan();

  useEffect(() => {
    if (input && (input !== s.input || (!s.result && !s.running && !s.error))) void s.run(input, s.questionnaire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <ScanInput initial={input} compact />
      </div>
      {s.running && <Progress />}
      {s.error && (
        <div className="notice danger" role="alert">
          {s.error}
        </div>
      )}
      {s.result && !s.running && <Results result={s.result} />}
    </>
  );
}

function Progress() {
  const s = useScan();
  return (
    <div className="card" aria-live="polite">
      <div className="eyebrow">Scanning</div>
      <h2 style={{ fontSize: 24 }}>Looking for every place this key has been revealed…</h2>
      <div className="scanline" style={{ margin: "16px 0 20px" }} />
      <ul className="progress-list">
        {s.progress.map((p) => (
          <li key={p.source}>
            <span className={`dot ${p.state}`} />
            {p.label}
            {p.state === "fail" && <span className="faint"> — unavailable</span>}
          </li>
        ))}
      </ul>
      {s.info.length > 0 && (
        <div className="faint mono" style={{ marginTop: 14, fontSize: 12 }}>
          {s.info[s.info.length - 1]}
        </div>
      )}
    </div>
  );
}

function Results({ result }: { result: ScanResult }) {
  const s = useScan();
  const t = result.totals;
  const priced = STATUSES.reduce((a, k) => a + t.usd[k], 0);
  const exposedNow = t.usd.EXPOSED_NOW;
  const visible = result.holdings.filter((h) => !h.details?.zeroBalance);
  const zero = result.holdings.filter((h) => h.details?.zeroBalance);
  const failed = result.sources.filter((x) => !x.ok);
  const hasUnknownOffchain = result.holdings.some((h) => h.reason === "evm-offchain-signature-possible");
  const isEvm = result.inputKind === "evm-address" || result.inputKind === "qore-address";

  return (
    <>
      <section className="card">
        <div className="headline">
          <div>
            <div className="eyebrow">Open to a quantum attacker today</div>
            <div className={`big-num ${exposedNow === 0 && t.count.EXPOSED_NOW === 0 ? "safe" : ""}`}>
              {result.scoreBasis === "usd" ? usd(exposedNow, { compact: true }) : `${t.count.EXPOSED_NOW} holding${t.count.EXPOSED_NOW === 1 ? "" : "s"}`}
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {visible.length === 0
                ? "No funds found for this input."
                : t.count.EXPOSED_NOW > 0
                  ? "These coins sit behind public keys that are already on-chain. Each row below links to the proof."
                  : "No key behind these funds is public at rest right now."}
            </p>
            <div className="bars" style={{ marginTop: 18 }}>
              {STATUSES.map((st) => {
                const v = result.scoreBasis === "usd" ? t.usd[st] : t.count[st];
                const total = result.scoreBasis === "usd" ? priced : STATUSES.reduce((a, k) => a + t.count[k], 0);
                const pct = total > 0 ? (100 * v) / total : 0;
                return (
                  <div className="bar-row" key={st}>
                    <span>{STATUS_LABEL[st]}</span>
                    <div className="bar">
                      <span style={{ width: `${pct}%`, background: STATUS_COLOR[st] }} />
                    </div>
                    <span className="mono" style={{ textAlign: "right" }}>
                      {result.scoreBasis === "usd" ? usd(v, { compact: true }) : v}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="gauge" style={{ ["--p" as string]: result.score }} role="img" aria-label={`Exposure score ${result.score} out of 100`}>
              <div>
                <span>
                  <b>{result.score}</b>
                  <span className="faint" style={{ fontSize: 12 }}>
                    / 100 exposed
                  </span>
                </span>
              </div>
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
              Share of {result.scoreBasis === "usd" ? "value" : "holdings"} exposed at rest
            </div>
            <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
              <a className="btn primary" href={href({ name: "plan" })}>
                Get my plan
              </a>
              <a className="btn" href={href({ name: "pass" })}>
                Protect on QoreChain
              </a>
            </div>
          </div>
        </div>
      </section>

      {failed.length > 0 && (
        <div className="notice" style={{ marginTop: 16 }}>
          Some sources were unavailable ({failed.map((f) => f.source).join(", ")}). Holdings we couldn't check are marked <b>Unknown</b> — never safe.
        </div>
      )}

      {result.qore && <QoreStatus result={result} />}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 24 }}>Holdings &amp; evidence</h2>
        {visible.length === 0 ? (
          <p className="muted">Nothing to show. {zero.length > 0 && "The key is still listed below."}</p>
        ) : (
          <HoldingsTable holdings={visible} />
        )}
        {zero.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>
              Evidence rows without balance ({zero.length})
            </summary>
            <div style={{ marginTop: 10 }}>
              <HoldingsTable holdings={zero} />
            </div>
          </details>
        )}
      </section>

      {isEvm && (
        <section className="card" style={{ marginTop: 24 }}>
          <h3>Refine the result</h3>
          <p className="muted">
            Off-chain signatures (permits, “Sign in with…”, signed messages) also reveal your key but never appear on-chain.
            {hasUnknownOffchain && " That's why some rows are Unknown."}
          </p>
          <Questionnaire
            value={s.questionnaire}
            onChange={(q) => {
              s.setQuestionnaire(q);
              void s.run(result.input, q);
            }}
          />
        </section>
      )}

      <p className="faint" style={{ fontSize: 13, marginTop: 24 }}>
        Scanned {new Date(result.scannedAt).toLocaleString()} · data: mempool.space, public EVM RPCs, QoreChain testnet REST, CoinGecko ·{" "}
        <a href={href({ name: "methodology" })}>methodology &amp; limits</a>
      </p>
    </>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const order: Record<Status, number> = { EXPOSED_NOW: 0, UNKNOWN: 1, EXPOSED_ON_SPEND: 2, PROTECTED: 3 };
  const rows = [...holdings].sort((a, b) => order[a.status] - order[b.status] || (b.usd ?? 0) - (a.usd ?? 0));
  return (
    <div className="table-wrap">
      <table className="holdings">
        <thead>
          <tr>
            <th>Status</th>
            <th>Chain · format</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th style={{ textAlign: "right" }}>Value</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const key = `${h.chain}:${h.locator}`;
            const r = REASONS[h.reason];
            return (
              <Fragment key={key}>
                <tr>
                  <td>
                    <span className={`pill ${h.status}`}>{STATUS_LABEL[h.status]}</span>
                  </td>
                  <td>
                    <div>
                      <b>{CHAIN_LABEL[h.chain]}</b> · {FORMAT_LABEL[h.format]}
                    </div>
                    <div className="locator" title={h.locator}>
                      {short(h.locator, 14, 10)}
                    </div>
                  </td>
                  <td className="num">
                    {amount(h.amount)} {h.asset}
                    {h.approximate && <span className="faint"> ≈</span>}
                  </td>
                  <td className="num">{usd(h.usd)}</td>
                  <td>
                    <div>{r.title}</div>
                    <div className="row" style={{ gap: 12, marginTop: 4 }}>
                      <button className="why" type="button" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                        {open === key ? "Hide" : "Why?"}
                      </button>
                      {h.evidence?.url && (
                        <a href={h.evidence.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          Evidence ↗
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
                {open === key && (
                  <tr>
                    <td colSpan={5} style={{ paddingTop: 0 }}>
                      <div className="why-panel">
                        <p style={{ margin: "0 0 8px" }}>{r.detail}</p>
                        {h.evidence?.note && <p style={{ margin: "0 0 8px" }}>{h.evidence.note}</p>}
                        {h.evidence?.txid && (
                          <div className="tx">
                            tx {h.evidence.txid}
                          </div>
                        )}
                        <a href={href({ name: "methodology", anchor: h.reason })}>Read the rule →</a>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QoreStatus({ result }: { result: ScanResult }) {
  const q = result.qore!;
  const w = q.window;
  return (
    <section className={`notice ${q.pqKeyRegistered ? "ok" : "danger"}`} style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>QoreChain testnet · {short(q.address, 10, 6)}</b>
        <a href={href({ name: "pass" })}>{q.pqKeyRegistered ? "Mint your Quantum Pass →" : "Register your PQ key →"}</a>
      </div>
      <p style={{ margin: "6px 0 0" }}>
        {q.pqKeyRegistered ? (
          <>
            ML-DSA-87 key registered{q.possessionProven ? " (possession proven)" : ""}. Native transactions need your post-quantum signature.{" "}
            {w?.live ? (
              <>
                An EVM window is open: if ECDSA broke tomorrow, at most <b>{uqorToQor(q.maxLossIfEcdsaBreaksUqor)} QOR</b> could move ({w.remainingTxs} txs,{" "}
                {w.remainingBlocks} blocks left).
              </>
            ) : (
              <>No EVM window is open — breaking ECDSA alone moves nothing.</>
            )}
          </>
        ) : (
          <>
            <b>No post-quantum key registered.</b> The first registration only needs a classical signature, so whoever breaks this ECDSA key first can
            register their own key and take the account. Registering early is the real protection.
          </>
        )}
      </p>
    </section>
  );
}

function Questionnaire({ value, onChange }: { value: Questionnaire; onChange: (q: Questionnaire) => void }) {
  const opts: { v: NonNullable<Questionnaire["signedMessages"]>; label: string }[] = [
    { v: "yes", label: "Yes" },
    { v: "no", label: "Never" },
    { v: "unsure", label: "Not sure" },
  ];
  return (
    <div className="q-group">
      <fieldset>
        <legend>Has this wallet ever signed a message, permit or “Sign in with…” request?</legend>
        <div className="seg" role="radiogroup">
          {opts.map((o) => (
            <label key={o.v}>
              <input type="radio" name="signed" checked={value.signedMessages === o.v} onChange={() => onChange({ ...value, signedMessages: o.v })} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
