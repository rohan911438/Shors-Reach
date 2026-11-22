import { useEffect, useRef, useState } from "react";

import { ScanInput } from "../components/ScanInput.js";
import { CountUp, Icon, useReveal } from "../components/ui.js";
import { AsciiOrb, PassCard, StoryVisual } from "../components/visuals.js";
import { usd } from "../lib/format.js";
import { usePassStats } from "../lib/passStats.js";

const STORY = [
  {
    k: "01 — receive",
    t: "Your address hides your key.",
    b: "A Bitcoin or Ethereum address is a hash of your public key. While nothing has been spent, a quantum computer has nothing to work on.",
  },
  {
    k: "02 — spend once",
    t: "One spend publishes it forever.",
    b: "To move coins you sign, and the signature carries your public key. It sits in the chain permanently — readable by anyone, including a future attacker.",
  },
  {
    k: "03 — it spreads",
    t: "One key, seven addresses, eight chains.",
    b: "The same key controls legacy, SegWit, nested, Taproot and raw-key outputs, and the same EVM account on every chain. Reveal it once and every one of them is exposed.",
  },
  {
    k: "04 — Q-Day",
    t: "Shor's algorithm turns it into your private key.",
    b: "A large enough quantum computer derives the private key from the public one. Funds that only need ECDSA to move are then anyone's — unless moving them needs a post-quantum signature.",
  },
];

const VERDICTS = [
  { c: "var(--danger)", t: "Exposed now", b: "The public key is on-chain. An attacker can work on it at leisure." },
  { c: "var(--warn)", t: "Exposed on spend", b: "Hidden behind a hash until you spend — then it races the mempool." },
  { c: "var(--ok)", t: "Protected", b: "Moving it needs a post-quantum signature. Breaking ECDSA alone does nothing." },
  { c: "var(--unknown)", t: "Unknown", b: "We could not prove it either way. Never counted as safe." },
];

const COMPARE: [string, boolean, boolean][] = [
  ["Derives every address form of one key (P2PKH, P2WPKH, P2SH-P2WPKH, P2TR, P2PK…)", true, false],
  ["Finds coins with no address at all (P2PK outputs)", true, false],
  ["Links each verdict to the transaction that revealed the key", true, false],
  ["Cross-chain: one EVM tx exposes the key on every chain", true, false],
  ["Runs in your browser — no address leaves your device", true, false],
  ["A next step that actually protects you, verified on-chain", true, false],
  ["Checks whether this one address has ever spent", true, true],
];

const FAQ = [
  { q: "Do you need my seed phrase or private key?", a: "Never. The scan uses public chain data only — an address, xpub or public key. Any tool asking for a seed phrase is a scam." },
  {
    q: "Is Q-Day actually coming?",
    a: "Nobody knows when. Estimates range from years to decades. What is certain: keys that are public today stay public, so the cheapest time to move is before it matters.",
  },
  {
    q: "Why is my address exposed if I never published my key?",
    a: "Spending reveals the public key in the transaction. On EVM chains one transaction on any chain reveals it for all of them. Every verdict links to the exact transaction.",
  },
  {
    q: "What does the Quantum Pass prove?",
    a: "That you hold a registered ML-DSA-87 key on QoreChain and signed your scan attestation with it. The contract re-checks the key on-chain through precompiles 0x0a01 and 0x0a02.",
  },
  { q: "Is this financial advice?", a: "No. It is a risk scanner with a methodology you can audit. The plan suggests hygiene steps, never buying anything." },
];

function Story() {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <section className="story" aria-label="How a key gets exposed">
      <StoryVisual step={step} />
      <div className="story-steps">
        {STORY.map((s, i) => (
          <div key={s.k} data-i={i} ref={(el) => (refs.current[i] = el)} className={`story-step ${step === i ? "active" : ""}`}>
            <div className="k">{s.k}</div>
            <h3>{s.t}</h3>
            <p>{s.b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const stats = usePassStats();
  useReveal();
  const ticker = (
    <>
      <span>
        <b className="r">~6.3M BTC</b> behind exposed keys
      </span>
      <span>
        <b>7</b> address forms per key
      </span>
      <span>
        <b>8</b> chains scanned
      </span>
      <span>
        <b className="g">{stats.totalPasses ?? "…"}</b> Quantum Passes minted · live
      </span>
      <span>
        <b>ML-DSA-87</b> verified on-chain via 0x0a01
      </span>
      <span>
        <b>0</b> addresses sent to our server
      </span>
      <span>
        <b>BIP-360</b> still a draft
      </span>
    </>
  );

  return (
    <div className="home">
      <section className="hero3">
        <div className="hero3-glow" aria-hidden="true" />
        <div className="hero3-floor" aria-hidden="true" />
        <div className="hero3-orb">
          <AsciiOrb />
        </div>

        <div className="wrap" style={{ width: "100%" }}>
          <a className="hero-tag" href="#/dashboard">
            <span className="live-dot" /> Live on QoreChain testnet · {stats.totalPasses ?? "…"} passes minted <Icon name="arrow" size={13} />
          </a>
          <div className="hero3-top">
            <h1>
              <span className="split-line">
                <span>Your keys</span>
              </span>
              <span className="split-line">
                <span style={{ animationDelay: "0.08s" }}>
                  are <em className="serif">already</em>
                </span>
              </span>
              <span className="split-line">
                <span style={{ animationDelay: "0.16s" }} className="red">
                  public.
                </span>
              </span>
            </h1>
            <p className="hero3-side reveal">
              A quantum computer needs your <b>public key</b>, not your address. Shor's Reach finds every place yours has been revealed — on Bitcoin,
              seven EVM chains and QoreChain — and proves it with the transaction that did it.
            </p>
          </div>
        </div>

        <div className="wrap hero3-bottom" style={{ width: "100%" }}>
          <ScanInput />
        </div>
      </section>

      <div className="ticker" aria-label="Key facts">
        <div className="ticker-track">
          {ticker}
          <span aria-hidden="true" style={{ display: "contents" }}>
            {ticker}
          </span>
        </div>
      </div>

      <div className="wrap">
        <section className="statement">
          <div className="eyebrow reveal">The problem</div>
          <p className="reveal">
            Address checkers look at one string. <span className="dim">An attacker looks at every output your key ever touched.</span> So do we.
          </p>
          <div className="statement-nums reveal">
            <div>
              <div className="n">
                ~<CountUp value={6.3} format={(n) => n.toFixed(1)} />M
              </div>
              <div className="l">BTC already behind exposed keys (Glassnode, Oct 2026)</div>
            </div>
            <div>
              <div className="n">
                <CountUp value={1} /> tx
              </div>
              <div className="l">on any EVM chain exposes your key on all of them</div>
            </div>
            <div>
              <div className="n lime">
                <CountUp value={stats.totalPasses} />
              </div>
              <div className="l">Quantum Passes minted on QoreChain — live</div>
            </div>
            <div>
              <div className="n lime">
                <CountUp value={stats.attestedExposedUsdFloor} format={(n) => usd(n, { compact: true })} />+
              </div>
              <div className="l">exposed value now attested under post-quantum keys — live</div>
            </div>
          </div>
        </section>

        <Story />

        <section className="verdicts">
          <div className="eyebrow reveal">Four verdicts · no guesswork</div>
          <div className="v-list">
            {VERDICTS.map((v, i) => (
              <div key={v.t} className="v-row reveal" style={{ ["--c" as string]: v.c }}>
                <span className="i">0{i + 1}</span>
                <h3>{v.t}</h3>
                <p>{v.b}</p>
                <span className="dot" />
              </div>
            ))}
          </div>
        </section>

        <section className="compare">
          <div className="eyebrow reveal">Why not an address checker?</div>
          <h2 className="reveal" style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 0.95, letterSpacing: "-0.05em", marginTop: 18, maxWidth: "14ch" }}>
            We scan <em className="serif">keys,</em> not addresses.
          </h2>
          <div className="cmp reveal" role="table" aria-label="Shor's Reach compared with a typical address checker">
            <div className="cmp-row head" role="row">
              <div role="columnheader">Capability</div>
              <div role="columnheader" className="us">
                Shor's Reach
              </div>
              <div role="columnheader">Address checker</div>
            </div>
            {COMPARE.map(([c, us, them]) => (
              <div className="cmp-row" role="row" key={c}>
                <div role="cell">{c}</div>
                <div role="cell" className="us">
                  {us ? <span className="yes">✓</span> : <span className="no">—</span>}
                </div>
                <div role="cell">{them ? <span className="yes">✓</span> : <span className="no">—</span>}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="passband reveal">
          <div>
            <div className="eyebrow">Then · move under post-quantum protection</div>
            <h2>Lock your account before an attacker can.</h2>
            <p>
              QoreChain requires a hybrid secp256k1 + ML-DSA-87 signature on every native transaction (<code>hybrid_signature_mode: required</code>).
              Breaking ECDSA alone moves nothing. Until you register a post-quantum key, though, whoever breaks your ECDSA key first can claim the
              account.
            </p>
            <ol className="pass-steps">
              <li>Scan — see what is exposed, with proof</li>
              <li>Plan — an AI advisor orders the fixes</li>
              <li>Register your ML-DSA-87 key with QoreX</li>
              <li>Mint a soulbound Quantum Pass, verified on-chain</li>
            </ol>
            <div className="row">
              <a className="btn primary" href="#/pass">
                Get your Quantum Pass <Icon name="arrow" size={16} />
              </a>
              <a className="btn" href="#/dashboard">
                See who already did
              </a>
            </div>
          </div>
          <PassCard score={72} />
        </section>

        <section className="faq-wrap">
          <div className="reveal">
            <div className="eyebrow">Questions</div>
            <h2>
              Straight <em className="serif">answers.</em>
            </h2>
            <p className="muted">Everything else is in the methodology — every rule, every limit.</p>
          </div>
          <div className="faq reveal">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <Icon name="plus" size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
