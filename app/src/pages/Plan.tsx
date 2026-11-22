import { useEffect, useState } from "react";

import { fallbackPlan } from "../advisor/fallback.js";
import type { AdviceResponse } from "../advisor/schema.js";
import { AskPanel } from "../components/AskPanel.js";
import { CHAIN_LABEL, FORMAT_LABEL, STATUS_LABEL, usd } from "../lib/format.js";
import { href } from "../lib/router.js";
import { useScan } from "../lib/scanStore.js";
import { toAnonymisedSummary } from "../scan/index.js";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "done"; advice: AdviceResponse };

export function Plan() {
  const s = useScan();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [showPayload, setShowPayload] = useState(false);
  const summary = s.result ? toAnonymisedSummary(s.result, s.questionnaire) : null;
  const key = summary ? JSON.stringify(summary) : "";

  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    const ctrl = new AbortController();
    setState({ kind: "loading" });
    (async () => {
      let advice: AdviceResponse;
      try {
        const res = await fetch("/api/advise", { method: "POST", headers: { "content-type": "application/json" }, body: key, signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        advice = (await res.json()) as AdviceResponse;
      } catch {
        if (cancelled) return;
        // Static hosting or advisor down → same deterministic plan, computed locally.
        advice = { plan: fallbackPlan(summary), source: "fallback", fallbackReason: "advisor-unreachable" };
      }
      if (!cancelled) setState({ kind: "done", advice });
    })();
    return () => {
      cancelled = true;
      ctrl.abort(); // superseded request (StrictMode, new scan): don't pay for a second model call
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!summary)
    return (
      <div className="card">
        <div className="eyebrow">AI advisor</div>
        <h2>Scan first</h2>
        <p className="muted">The advisor turns a scan into a prioritised plan. Run a scan, then come back here.</p>
        <a className="btn primary" href="#/">
          Start a scan
        </a>
      </div>
    );

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Your plan</div>
          <h1 className="page-title" style={{ margin: 0 }}>
            What to do, <em className="serif">in order</em>
          </h1>
        </div>
        {state.kind === "done" && (
          <span className={`pill ${state.advice.source === "ai" ? "PROTECTED" : "UNKNOWN"}`} title={state.advice.fallbackReason}>
            {state.advice.source === "ai" ? `AI-generated · ${state.advice.model}` : "Rule-based plan"}
          </span>
        )}
      </div>

      {state.kind === "loading" && (
        <div className="card" aria-live="polite">
          <p className="muted" style={{ margin: 0 }}>
            Writing your plan from the anonymised summary…
          </p>
          <div className="scanline" style={{ marginTop: 14 }} />
        </div>
      )}

      {state.kind === "done" && (
        <>
          <section className="card">
            <p style={{ fontSize: 18, margin: 0 }}>{state.advice.plan.summary}</p>
          </section>

          <section style={{ marginTop: 20 }} className="stepper">
            {state.advice.plan.actions.map((a) => (
              <div key={a.priority + a.title} className={`s ${a.priority === 1 ? "active" : ""}`}>
                <div className="badge">{a.priority}</div>
                <div>
                  <h3>{a.title}</h3>
                  <p className="muted" style={{ margin: "0 0 6px" }}>
                    {a.why}
                  </p>
                  <p style={{ margin: 0 }}>
                    <b>How: </b>
                    {a.how}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <div className="grid-2" style={{ marginTop: 20 }}>
            <section className="card">
              <h3>Stop doing</h3>
              <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                {state.advice.plan.stopDoing.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h3>What we can't know</h3>
              <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                {state.advice.plan.unknowns.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="notice info" style={{ marginTop: 20 }}>
            <b>QoreChain · </b>
            {state.advice.plan.qorechainNote} <a href={href({ name: "pass" })}>Protect your QoreChain account →</a>
          </section>
        </>
      )}

      {state.kind === "done" && <AskPanel summary={summary} plan={state.advice.plan} />}

      <section className="card" style={{ marginTop: 20 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>What the advisor saw</h3>
          <button className="btn small" type="button" onClick={() => setShowPayload(!showPayload)}>
            {showPayload ? "Hide raw JSON" : "Show raw JSON"}
          </button>
        </div>
        <p className="muted">Only this anonymised summary leaves your browser — no addresses, transactions or exact amounts.</p>
        {showPayload ? (
          <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--bg-2)", padding: 12, borderRadius: 9, overflowX: "auto" }}>
            {JSON.stringify(summary, null, 2)}
          </pre>
        ) : (
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {summary.holdings.slice(0, 8).map((h, i) => (
              <li key={i}>
                {CHAIN_LABEL[h.chain]} · {FORMAT_LABEL[h.format]} — {STATUS_LABEL[h.status]} {h.usdRounded !== null && `(~${usd(h.usdRounded, { compact: true })})`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="faint" style={{ fontSize: 13, marginTop: 18 }}>
        Not financial advice. Shor's Reach never asks for seed phrases or private keys.
      </p>
    </>
  );
}
