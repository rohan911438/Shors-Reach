import { useEffect, useRef, useState, type FormEvent } from "react";

import { EXAMPLES } from "../components/ScanInput.js";

const origin = typeof window === "undefined" ? "https://shors-reach.vercel.app" : window.location.origin;

const CURL = `curl -s -X POST ${origin}/api/v1/scan \\
  -H "content-type: application/json" \\
  -d '{"input":"bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297"}'`;

const JS = `const res = await fetch("${origin}/api/v1/scan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ input: userAddress }),
});
const { verdict, score, holdings } = await res.json();
if (verdict === "exposed") showQuantumWarning(holdings.filter(h => h.status === "EXPOSED_NOW"));`;

const WIDGET = `<div data-shors-reach data-input="bc1q…" data-theme="dark"></div>
<script src="${origin}/widget.js" async></script>

<script>
  document.addEventListener("shorsreach:result", (e) => {
    console.log(e.detail); // { verdict, score, exposedUsd }
  });
</script>`;

const RESPONSE = `{
  "apiVersion": "1",
  "inputKind": "btc-address",
  "verdict": "exposed",          // exposed | exposed-on-spend | protected | no-funds | incomplete
  "score": 100,                  // 0–100 share of value exposed at rest (higher = worse)
  "totalsUsd": { "EXPOSED_NOW": 156.2, "EXPOSED_ON_SPEND": 0, "PROTECTED": 0, "UNKNOWN": 0 },
  "holdings": [{
    "chain": "bitcoin", "format": "p2tr", "status": "EXPOSED_NOW",
    "reason": "btc-taproot-output-key", "reasonTitle": "Taproot output key",
    "amount": "0.0016", "asset": "BTC", "usd": 156.2,
    "evidenceUrl": "https://mempool.space/tx/…", "evidenceTxid": "…"
  }],
  "sources": [{ "source": "mempool.space", "ok": true }],
  "reportUrl": "${origin}/#/scan/…"
}`;

function Code({ children, label }: { children: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="dev-code">
      <div className="dev-code-bar">
        <span className="faint">{label}</span>
        <button
          className="link-btn"
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(children).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mono">{children}</pre>
    </div>
  );
}

function Playground() {
  const [input, setInput] = useState(EXAMPLES[2]!.input);
  const [out, setOut] = useState<string | null>(null);
  const [meta, setMeta] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const run = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOut(null);
    const t = performance.now();
    try {
      const res = await fetch("/api/v1/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }) });
      const body = await res.text();
      setMeta(`HTTP ${res.status} · ${Math.round(performance.now() - t)} ms`);
      try {
        setOut(JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        setOut(body);
      }
    } catch (err) {
      setMeta("Network error");
      setOut(String(err));
    }
    setBusy(false);
  };
  return (
    <section className="card" style={{ marginTop: 20 }} aria-labelledby="pg-title">
      <h3 id="pg-title" style={{ marginTop: 0 }}>
        Try it
      </h3>
      <form className="scanbox compact-pg" onSubmit={run}>
        <label className="sr-only" htmlFor="pg-input">
          Input
        </label>
        <input id="pg-input" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" spellCheck={false} />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Scanning…" : "POST /api/v1/scan"}
        </button>
      </form>
      <div className="chips" style={{ justifyContent: "flex-start", marginTop: 10 }}>
        {EXAMPLES.map((x) => (
          <button key={x.label} type="button" className="chip" onClick={() => setInput(x.input)}>
            {x.label}
          </button>
        ))}
      </div>
      {out && (
        <div className="dev-code" style={{ marginTop: 12 }}>
          <div className="dev-code-bar">
            <span className="faint" data-testid="pg-meta">
              {meta}
            </span>
          </div>
          <pre className="mono dev-out" data-testid="pg-out">
            {out}
          </pre>
        </div>
      )}
    </section>
  );
}

function WidgetPreview() {
  const host = useRef<HTMLDivElement>(null);
  const [event, setEvent] = useState<string | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const on = (e: Event) => setEvent(JSON.stringify((e as CustomEvent).detail));
    el.addEventListener("shorsreach:result", on);
    const w = window as { ShorsReach?: { mount: (el: Element) => void } };
    const mountAll = () => el.querySelectorAll("[data-shors-reach]").forEach((x) => w.ShorsReach?.mount(x));
    if (w.ShorsReach) mountAll();
    else {
      const s = document.createElement("script");
      s.src = "/widget.js";
      s.async = true;
      s.onload = mountAll;
      document.head.appendChild(s);
    }
    return () => el.removeEventListener("shorsreach:result", on);
  }, []);
  return (
    <div ref={host} className="dev-widgets">
      <div>
        <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>
          With an address
        </div>
        <div data-shors-reach data-input={EXAMPLES[2]!.input} data-theme="dark" />
      </div>
      <div>
        <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>
          Input mode, light theme
        </div>
        <div data-shors-reach data-theme="light" />
      </div>
      <div className="faint mono" style={{ fontSize: 12, gridColumn: "1 / -1" }} data-testid="widget-event">
        {event ? `shorsreach:result → ${event}` : "waiting for shorsreach:result…"}
      </div>
    </div>
  );
}

export function Developers() {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow">For wallets, exchanges &amp; custodians</div>
        <h1 className="page-title" style={{ margin: 0 }}>
          Put the check <em className="serif">where users already are</em>
        </h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          The same key-level engine as this site — sibling forms, P2PK, Taproot, xpub gap scan, 8 chains, evidence for every red row — as a JSON API for your
          backend, or a drop-in widget for your app. Free while QoreChain is on testnet.
        </p>
      </div>

      <div className="grid-2 dev-choices">
        <section className="card">
          <div className="eyebrow">Option 1</div>
          <h3>Scan API</h3>
          <p className="muted">Server-to-server. Flag exposed customer deposits, warn before a withdrawal to a reused address, or report exposure across custody.</p>
          <ul className="muted dev-list">
            <li>
              <code>POST /api/v1/scan</code> · JSON in, JSON out · CORS open
            </li>
            <li>60 requests / hour / IP; partner keys (<code>x-api-key</code>) for more</li>
            <li>Inputs are processed in memory — never stored, never logged</li>
          </ul>
        </section>
        <section className="card">
          <div className="eyebrow">Option 2</div>
          <h3>Embeddable widget</h3>
          <p className="muted">Two lines of HTML. The scan runs in your user's browser, inside the widget — your page and our servers never handle the address data.</p>
          <ul className="muted dev-list">
            <li>Dark or light, resizes itself, ~2 kB loader</li>
            <li>
              Emits <code>shorsreach:result</code> so your app can react
            </li>
            <li>Links to the full report, evidence and AI plan</li>
          </ul>
        </section>
      </div>

      <h2 className="dev-h2">Scan API</h2>
      <div className="grid-2">
        <Code label="curl">{CURL}</Code>
        <Code label="JavaScript">{JS}</Code>
      </div>
      <Code label="Response (abridged)">{RESPONSE}</Code>
      <div className="card dev-table" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>200</td>
              <td>
                Scan done. Check <code>verdict</code>; <code>incomplete</code> means a data source failed — never treat it as safe.
              </td>
            </tr>
            <tr>
              <td>400</td>
              <td>
                <code>bad-json</code>, <code>missing-input</code>, <code>bad-input</code> or <code>seed-phrase</code> (refused, never processed)
              </td>
            </tr>
            <tr>
              <td>401 / 429</td>
              <td>Unknown API key / rate limit (see Retry-After)</td>
            </tr>
            <tr>
              <td>502</td>
              <td>An upstream data source failed mid-scan — retry</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Playground />

      <h2 className="dev-h2">Widget</h2>
      <Code label="HTML">{WIDGET}</Code>
      <section className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Live preview</h3>
        <WidgetPreview />
      </section>

      <p className="faint" style={{ fontSize: 13, marginTop: 18 }}>
        Methodology and every reason code: <a href="#/methodology">#/methodology</a>. Not financial advice. Never send seed phrases or private keys to any API.
      </p>
    </>
  );
}
