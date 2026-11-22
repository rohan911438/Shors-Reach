import { useRef, useState, type FormEvent } from "react";

import { fallbackAnswer, type AskResponse } from "../advisor/ask.js";
import type { Plan, Summary } from "../advisor/schema.js";
import { looksLikeSeedPhrase } from "../lib/seed.js";
import { containsIdentifier } from "../scan/score/summary.js";

interface Turn {
  q: string;
  a: AskResponse;
}

const STARTERS = ["Why are some of my holdings red?", "What do I do with a Ledger?", "What should I move first?"];

/** Follow-up questions on the plan. Sends only the anonymised summary, the plan and the questions. */
export function AskPanel({ summary, plan }: { summary: Summary; plan: Plan | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    if (looksLikeSeedPhrase(q)) {
      setValue("");
      setError("That looks like a seed phrase. Never paste it anywhere — not here, not into any website.");
      return;
    }
    if (containsIdentifier(q)) {
      setError("Please ask without pasting addresses, transaction IDs or keys — describe the holding instead (e.g. “my Taproot address”).");
      return;
    }
    setError(null);
    setBusy(true);
    setValue("");
    const history = turns.slice(-4).map((t) => ({ q: t.q, a: t.a.answer }));
    let a: AskResponse;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary, plan, question: q, history }),
      });
      const body = (await res.json().catch(() => null)) as (AskResponse & { error?: string }) | null;
      if (res.status === 400 && body?.error) {
        setError(body.error);
        setBusy(false);
        return;
      }
      if (!res.ok || !body?.answer) throw new Error(`HTTP ${res.status}`);
      a = body;
    } catch {
      a = { ...fallbackAnswer({ summary, plan, question: q, history }), source: "fallback", fallbackReason: "advisor-unreachable" };
    }
    setTurns((t) => [...t, { q, a }]);
    setBusy(false);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(value);
  };

  const suggestions = turns.length ? turns[turns.length - 1]!.a.followUps : STARTERS;

  return (
    <section className="card ask" style={{ marginTop: 20 }} aria-labelledby="ask-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 id="ask-title" style={{ margin: 0 }}>
          Ask about your plan
        </h3>
        <span className="faint" style={{ fontSize: 12 }}>
          Sees only the anonymised summary
        </span>
      </div>

      {turns.length > 0 && (
        <div className="ask-log" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className="ask-turn">
              <div className="ask-q">{t.q}</div>
              <div className="ask-a">
                {t.a.answer.split(/\n{2,}/).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                <div className="faint ask-src">{t.a.source === "ai" ? `AI · ${t.a.model}` : "Rule-based answer"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {busy && (
        <div className="ask-turn" aria-live="polite">
          <div className="ask-a muted">Thinking…</div>
        </div>
      )}
      <div ref={endRef} />

      <div className="chips" style={{ justifyContent: "flex-start", marginTop: 12 }}>
        {suggestions.map((s) => (
          <button key={s} type="button" className="chip" disabled={busy} onClick={() => void send(s)}>
            {s}
          </button>
        ))}
      </div>

      <form className="scanbox ask-box" onSubmit={submit} style={{ marginTop: 12 }}>
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-input"
          value={value}
          maxLength={400}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Why is my Taproot address red?"
          autoComplete="off"
          spellCheck
        />
        <button className="btn primary" type="submit" disabled={busy || value.trim().length < 2}>
          Ask
        </button>
      </form>
      {error && (
        <div className="input-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
