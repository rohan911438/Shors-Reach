import { ScanInput } from "../components/ScanInput.js";
import { usd } from "../lib/format.js";
import { usePassStats } from "../lib/passStats.js";

export function Home() {
  const stats = usePassStats();
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Q-Day exposure scanner · Bitcoin + 7 EVM chains + QoreChain</div>
        <h1>
          How much of your crypto <span className="grad-text">dies on Q-Day?</span>
        </h1>
        <p className="lead">
          A quantum computer needs your <b>public key</b>, not your address. Shor's Reach finds every place your key has been revealed — and proves
          it with the transaction that did it.
        </p>
        <ScanInput />
      </section>

      <div className="stats">
        <div className="stat">
          <div className="num">~6.3M BTC</div>
          <div className="lbl">already behind exposed keys (Glassnode, Oct 2026)</div>
        </div>
        <div className="stat">
          <div className="num">1 tx</div>
          <div className="lbl">on any EVM chain exposes your key on all of them</div>
        </div>
        <div className="stat">
          <div className="num grad-text">{stats.totalPasses ?? "…"}</div>
          <div className="lbl">Quantum Passes minted on QoreChain (live)</div>
        </div>
        <div className="stat">
          <div className="num grad-text">{stats.attestedExposedUsdFloor === null ? "…" : usd(stats.attestedExposedUsdFloor, { compact: true })}+</div>
          <div className="lbl">exposed value now attested under PQ keys (live)</div>
        </div>
      </div>

      <section className="section">
        <div className="eyebrow">Why address checkers get it wrong</div>
        <h2>We scan keys, not addresses.</h2>
        <div className="grid-3" style={{ marginTop: 20 }}>
          <div className="card">
            <h3>One key, seven addresses</h3>
            <p className="muted">
              The same key controls legacy, SegWit, nested, Taproot and raw-key outputs. Spend from one and all of them are exposed. We derive every
              form and check each.
            </p>
          </div>
          <div className="card">
            <h3>Coins with no address</h3>
            <p className="muted">
              Satoshi-era coins sit in pay-to-public-key outputs. Satoshi's famous address shows zero spends — yet its key has been public since block 0.
            </p>
          </div>
          <div className="card">
            <h3>Taproot is the most exposed</h3>
            <p className="muted">The newest Bitcoin format writes a public key into every output. It is exposed the moment it receives coins.</p>
          </div>
          <div className="card">
            <h3>Chains share your key</h3>
            <p className="muted">Never sent on Ethereum, but bridged once on Base? Your Ethereum balance is exposed too.</p>
          </div>
          <div className="card">
            <h3>Evidence for every verdict</h3>
            <p className="muted">Each red row links to the transaction that revealed the key. No evidence — no alarm. Verify, don't believe.</p>
          </div>
          <div className="card">
            <h3>Private by design</h3>
            <p className="muted">The scan runs in your browser. Our server never sees your addresses; the AI advisor only gets an anonymised summary.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">Then: move under post-quantum protection</div>
        <h2>Lock your QoreChain account before an attacker can.</h2>
        <div className="grid-2" style={{ marginTop: 20 }}>
          <div className="card steps">
            <div className="step" style={{ marginBottom: 18 }}>
              <b>Scan</b>
              <div className="muted">See exactly what is exposed, with proof.</div>
            </div>
            <div className="step" style={{ marginBottom: 18 }}>
              <b>Get a plan</b>
              <div className="muted">An AI advisor turns the result into calm, prioritised steps.</div>
            </div>
            <div className="step" style={{ marginBottom: 18 }}>
              <b>Register your ML-DSA-87 key</b>
              <div className="muted">Until you do, whoever breaks your ECDSA key first can claim your QoreChain account.</div>
            </div>
            <div className="step">
              <b>Mint your Quantum Pass</b>
              <div className="muted">Signed with your post-quantum key and verified on-chain by QoreChain's ML-DSA precompile.</div>
            </div>
          </div>
          <div className="card">
            <h3>Why QoreChain</h3>
            <p className="muted">
              QoreChain requires a hybrid secp256k1 + ML-DSA-87 signature on every native transaction (
              <code>hybrid_signature_mode: required</code>, <code>allow_classical_fallback: false</code>). Breaking ECDSA alone moves nothing.
            </p>
            <p className="muted">
              Bitcoin's fix (BIP-360) is a draft; Ethereum targets ~2029 for post-quantum accounts. QoreChain is one of the few places you can hold value
              under post-quantum signatures today.
            </p>
            <a className="btn" href="#/pass">
              Get your Quantum Pass →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
