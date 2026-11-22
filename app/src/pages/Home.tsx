import { ScanInput } from "../components/ScanInput.js";
import { CountUp, Icon, Spotlight, useReveal, type IconName } from "../components/ui.js";
import { usd } from "../lib/format.js";
import { usePassStats } from "../lib/passStats.js";

const CHAINS = ["Bitcoin", "Ethereum", "Base", "Arbitrum", "OP Mainnet", "Polygon", "BNB Chain", "Avalanche", "QoreChain"];

const FEATURES: { icon: IconName; title: string; body: string; wide?: boolean; full?: boolean }[] = [
  {
    icon: "key",
    title: "One key, seven addresses",
    body: "The same key controls legacy, SegWit, nested, Taproot and raw-key outputs. Spend from one and all of them are exposed. We derive every form and check each.",
    wide: true,
  },
  { icon: "ghost", title: "Coins with no address", body: "Satoshi-era coins sit in pay-to-public-key outputs. Their key has been public since block 0." },
  { icon: "bolt", title: "Taproot is the most exposed", body: "The newest Bitcoin format writes a public key into every output — exposed the moment it receives coins." },
  { icon: "link", title: "Chains share your key", body: "Never sent on Ethereum, but bridged once on Base? Your Ethereum balance is exposed too." },
  { icon: "doc", title: "Evidence for every verdict", body: "Each red row links to the transaction that revealed the key. No evidence — no alarm. Verify, don't believe." },
  {
    icon: "eye",
    title: "Private by design",
    body: "The scan runs in your browser. Our server never sees your addresses; the AI advisor only gets an anonymised summary — and you can read exactly what it saw.",
    full: true,
  },
];

const STATES = [
  { cls: "EXPOSED_NOW", title: "Exposed now", body: "Public key is on-chain. An attacker can work on it at leisure." },
  { cls: "EXPOSED_ON_SPEND", title: "Exposed on spend", body: "Key is hidden behind a hash until you spend — then it races the mempool." },
  { cls: "PROTECTED", title: "Protected", body: "Moving it needs a post-quantum signature. Breaking ECDSA alone does nothing." },
  { cls: "UNKNOWN", title: "Unknown", body: "We could not prove it either way. Never counted as safe." },
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "scan", title: "Scan", body: "See exactly what is exposed, with the transaction that proves it." },
  { icon: "spark", title: "Get a plan", body: "An AI advisor turns the result into calm, prioritised steps." },
  { icon: "key", title: "Register an ML-DSA-87 key", body: "Until you do, whoever breaks your ECDSA key first can claim your QoreChain account." },
  { icon: "shield", title: "Mint your Quantum Pass", body: "A soulbound pass, verified on-chain by QoreChain's post-quantum precompile." },
];

const FAQ = [
  {
    q: "Do you need my seed phrase or private key?",
    a: "Never. The scan uses public chain data only — an address, xpub or public key. Any tool asking for a seed phrase is a scam.",
  },
  {
    q: "Is Q-Day actually coming?",
    a: "Nobody knows when. Estimates range from years to decades. What is certain: keys that are public today stay public, so the cheapest time to move is before it matters.",
  },
  {
    q: "Why is my address marked exposed if I never published my key?",
    a: "Spending reveals the public key in the transaction. On EVM chains one transaction on any chain reveals it for all of them. Every verdict links to the exact transaction.",
  },
  {
    q: "What does the Quantum Pass prove?",
    a: "That you hold a registered ML-DSA-87 key on QoreChain and signed your scan attestation with it. The contract re-checks the key on-chain through precompiles 0x0a01 and 0x0a02.",
  },
  {
    q: "Is this financial advice?",
    a: "No. It is a risk scanner with a methodology you can audit. The plan suggests safe hygiene steps, never buying anything.",
  },
];

/** The attacker's view: a looping illustrative terminal of a real scan (Satoshi's genesis key). */
function Terminal() {
  const lines: [string, string][] = [
    ["$ shors-reach scan 04678afd…1d5f", "cmd"],
    ["→ deriving 7 address forms from one key", "dim"],
    ["→ P2PK output in block 0 · coinbase", "dim"],
    ["  bitcoin · p2pk      EXPOSED_NOW   50.00 BTC", "bad"],
    ["  bitcoin · p2pkh     EXPOSED_NOW  ≈ 50 BTC", "bad"],
    ["  bitcoin · p2wpkh    UNKNOWN        0.00 BTC", "dim"],
    ["  evidence: genesis coinbase tx 4a5e1e4b…", "link"],
    ["✓ score 100 / 100 · open to a quantum attacker", "warn"],
  ];
  return (
    <div className="term reveal" role="img" aria-label="Example scan output for Satoshi's genesis public key: every holding exposed now">
      <div className="term-bar">
        <span />
        <span />
        <span />
        <b>attacker's view</b>
      </div>
      <pre>
        {lines.map(([t, c], i) => (
          <div key={i} className={`tl ${c}`} style={{ animationDelay: `${0.25 + i * 0.32}s` }}>
            {t}
          </div>
        ))}
        <div className="tl caret" style={{ animationDelay: `${0.25 + lines.length * 0.32}s` }}>
          _
        </div>
      </pre>
    </div>
  );
}

export function Home() {
  const stats = usePassStats();
  useReveal();
  return (
    <>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <a className="live-chip" href="#/dashboard">
          <span className="live-dot" /> Live on QoreChain testnet · {stats.totalPasses ?? "…"} passes minted
          <Icon name="arrow" size={14} />
        </a>
        <h1>
          How much of your crypto
          <br />
          <em className="serif">dies</em> on <span className="grad-text">Q-Day?</span>
        </h1>
        <p className="lead">
          A quantum computer needs your <b>public key</b>, not your address. Shor's Reach finds every place your key has been revealed — and proves it
          with the transaction that did it.
        </p>
        <ScanInput />
        <ul className="trust" aria-label="Guarantees">
          <li>
            <Icon name="lock" size={15} /> Runs in your browser
          </li>
          <li>
            <Icon name="eye" size={15} /> No sign-up, no tracking
          </li>
          <li>
            <Icon name="doc" size={15} /> Open-source methodology
          </li>
        </ul>
      </section>

      <div className="marquee" aria-label={`Chains scanned: ${CHAINS.join(", ")}`}>
        <div className="marquee-track" aria-hidden="true">
          {[...CHAINS, ...CHAINS].map((c, i) => (
            <span key={i} className={c === "QoreChain" ? "q" : ""}>
              <Icon name="atom" size={16} /> {c}
            </span>
          ))}
        </div>
      </div>

      <div className="stats reveal">
        <div className="stat">
          <div className="num">
            ~<CountUp value={6.3} format={(n) => n.toFixed(1)} />M BTC
          </div>
          <div className="lbl">already behind exposed keys (Glassnode, Oct 2026)</div>
        </div>
        <div className="stat">
          <div className="num">
            <CountUp value={1} /> tx
          </div>
          <div className="lbl">on any EVM chain exposes your key on all of them</div>
        </div>
        <div className="stat">
          <div className="num grad-text">
            <CountUp value={stats.totalPasses} />
          </div>
          <div className="lbl">Quantum Passes minted on QoreChain (live)</div>
        </div>
        <div className="stat">
          <div className="num grad-text">
            <CountUp value={stats.attestedExposedUsdFloor} format={(n) => usd(n, { compact: true })} />+
          </div>
          <div className="lbl">exposed value now attested under PQ keys (live)</div>
        </div>
      </div>

      <section className="section split">
        <div className="reveal">
          <div className="eyebrow">See what an attacker sees</div>
          <h2>
            We scan <em className="serif">keys,</em> not addresses.
          </h2>
          <p className="muted lead-sm">
            Address checkers look at one string. A quantum attacker looks at every output your key ever touched. So do we — across Bitcoin, seven EVM
            chains and QoreChain — and every red row comes with its evidence.
          </p>
          <a className="btn" href="#/methodology">
            Read the methodology <Icon name="arrow" size={16} />
          </a>
        </div>
        <Terminal />
      </section>

      <section className="section">
        <div className="bento">
          {FEATURES.map((f) => (
            <Spotlight key={f.title} className={`reveal ${f.wide ? "wide" : ""} ${f.full ? "full" : ""}`}>
              <div className="ico">
                <Icon name={f.icon} size={22} />
              </div>
              <h3>{f.title}</h3>
              <p className="muted">{f.body}</p>
            </Spotlight>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="eyebrow reveal">Four verdicts, no guesswork</div>
        <h2 className="reveal">Every holding gets exactly one status.</h2>
        <div className="states">
          {STATES.map((s, i) => (
            <div key={s.cls} className="state reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className={`pill ${s.cls}`}>{s.title}</span>
              <p className="muted">{s.body}</p>
              <div className={`state-bar ${s.cls}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="eyebrow reveal">Then: move under post-quantum protection</div>
        <h2 className="reveal">Lock your QoreChain account before an attacker can.</h2>
        <div className="grid-2" style={{ marginTop: 24 }}>
          <ol className="timeline reveal">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <div className="t-ico">
                  <Icon name={s.icon} size={18} />
                </div>
                <div>
                  <div className="t-n">0{i + 1}</div>
                  <b>{s.title}</b>
                  <div className="muted">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
          <Spotlight className="reveal why-qore">
            <div className="ico">
              <Icon name="shield" size={22} />
            </div>
            <h3>Why QoreChain</h3>
            <p className="muted">
              QoreChain requires a hybrid secp256k1 + ML-DSA-87 signature on every native transaction (<code>hybrid_signature_mode: required</code>,{" "}
              <code>allow_classical_fallback: false</code>). Breaking ECDSA alone moves nothing.
            </p>
            <p className="muted">
              Bitcoin's fix (BIP-360) is a draft; Ethereum targets ~2029 for post-quantum accounts. QoreChain is one of the few places you can hold value
              under post-quantum signatures today.
            </p>
            <a className="btn primary" href="#/pass">
              Get your Quantum Pass <Icon name="arrow" size={16} />
            </a>
          </Spotlight>
        </div>
      </section>

      <section className="section faq-wrap">
        <div className="reveal">
          <div className="eyebrow">Questions</div>
          <h2>Straight answers.</h2>
          <p className="muted">Everything else is in the methodology — every rule, every limit.</p>
        </div>
        <div className="faq reveal">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <Icon name="plus" size={18} />
              </summary>
              <p className="muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section cta-band reveal">
        <div className="cta-grid" aria-hidden="true" />
        <h2>
          Build before <span className="grad-text">Q-Day.</span>
        </h2>
        <p className="muted">One scan. Thirty seconds. No sign-up.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <a className="btn primary" href="#/" onClick={() => document.getElementById("scan-input")?.focus()}>
            <Icon name="scan" size={16} /> Scan an address
          </a>
          <a className="btn" href="#/dashboard">
            <Icon name="chart" size={16} /> Live dashboard
          </a>
        </div>
      </section>
    </>
  );
}
