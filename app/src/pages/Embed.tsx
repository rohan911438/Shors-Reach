/**
 * #/embed/<input> — the page inside the embeddable widget's iframe (see public/widget.js).
 * The scan runs here, in the visitor's browser, so the host site and our servers never see the address
 * (except the public chain/price APIs every scan uses). Height and result go to the host via postMessage.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";

import { usd } from "../lib/format.js";
import { looksLikeSeedPhrase } from "../lib/seed.js";
import { detectInput, scan } from "../scan/index.js";
import type { ScanResult } from "../scan/types.js";
import { verdictOf, type Verdict } from "../api/scanApi.js";

const VERDICT: Record<Verdict, { label: string; tone: string; line: string }> = {
  exposed: { label: "Exposed", tone: "EXPOSED_NOW", line: "Some funds sit behind a public key a quantum computer could attack." },
  "exposed-on-spend": { label: "Hidden until spent", tone: "EXPOSED_ON_SPEND", line: "Keys stay hidden until you spend. Avoid address reuse." },
  protected: { label: "Protected", tone: "PROTECTED", line: "Nothing exposed at rest." },
  "no-funds": { label: "No funds found", tone: "UNKNOWN", line: "Nothing held here right now." },
  incomplete: { label: "Scan incomplete", tone: "UNKNOWN", line: "A data source didn't answer. Try again." },
};

const post = (msg: Record<string, unknown>) => {
  if (window.parent !== window) window.parent.postMessage({ source: "shors-reach", ...msg }, "*");
};

export function Embed({ input }: { input: string }) {
  const [value, setValue] = useState("");
  const [current, setCurrent] = useState(input);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("embed-mode");
    const ro = new ResizeObserver(() => post({ type: "shors-reach:resize", height: root.current?.getBoundingClientRect().height ?? 0 }));
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    setResult(null);
    scan(current, { qoreRest: "/lcd-testnet" })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        post({ type: "shors-reach:result", verdict: verdictOf(r), score: r.score, exposedUsd: Math.round(r.totals.usd.EXPOSED_NOW) });
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [current]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (looksLikeSeedPhrase(v)) {
      setValue("");
      return setError("That looks like a seed phrase. Never paste it anywhere.");
    }
    try {
      detectInput(v);
    } catch (err) {
      return setError(err instanceof Error ? err.message : String(err));
    }
    setCurrent(v);
  };

  const origin = window.location.origin;
  const v = result ? VERDICT[verdictOf(result)] : null;
  const exposed = result ? result.holdings.filter((h) => h.status === "EXPOSED_NOW" && !h.details?.zeroBalance) : [];

  return (
    <div className="embed" ref={root}>
      <div className="embed-head">
        <span className="brand-mark" aria-hidden>
          ⚛
        </span>
        <b>Quantum exposure check</b>
      </div>

      {!input && (
        <form className="embed-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="embed-input">
            Address, public key or xpub
          </label>
          <input
            id="embed-input"
            className="mono"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Bitcoin address, xpub, 0x…"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn primary small" type="submit" disabled={busy}>
            Check
          </button>
        </form>
      )}

      {busy && (
        <div className="embed-body" aria-live="polite">
          <span className="muted">Scanning public chain data…</span>
          <div className="scanline" />
        </div>
      )}
      {error && (
        <div className="input-error" role="alert">
          {error}
        </div>
      )}

      {result && v && (
        <div className="embed-body" aria-live="polite">
          <div className="embed-verdict">
            <span className={`pill ${v.tone}`}>{v.label}</span>
            <span className="embed-score">
              <b>{result.score}</b>
              <span className="faint">/100 exposed</span>
            </span>
          </div>
          <p className="muted" style={{ margin: "8px 0" }}>
            {v.line}
            {result.totals.usd.EXPOSED_NOW > 0 && (
              <>
                {" "}
                <b style={{ color: "var(--danger)" }}>{usd(result.totals.usd.EXPOSED_NOW, { compact: true })}</b> exposed now across {exposed.length} holding
                {exposed.length === 1 ? "" : "s"}.
              </>
            )}
          </p>
        </div>
      )}

      <div className="embed-foot">
        {result ? (
          <a href={`${origin}/#/scan/${encodeURIComponent(result.input)}`} target="_blank" rel="noopener">
            Full report, evidence &amp; plan →
          </a>
        ) : (
          <span className="faint">Public data only · runs in your browser</span>
        )}
        <a className="faint" href={origin} target="_blank" rel="noopener">
          Shor's Reach
        </a>
      </div>
    </div>
  );
}
