import { useMemo, useState } from "react";

import { usd } from "../lib/format.js";

/**
 * 1200×675 share image built as SVG (no addresses, no exact amounts), rendered to PNG via canvas for download.
 */
function cardSvg(score: number, exposedUsd: number, protectedOnQore: boolean): string {
  const amount = exposedUsd > 0 ? usd(exposedUsd, { compact: true }) : "$0";
  const headline = protectedOnQore ? "Now protected on QoreChain" : "Exposed to a quantum attacker";
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0" r="0.8"><stop offset="0" stop-color="#a78bfa" stop-opacity="0.35"/><stop offset="1" stop-color="#07080c" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="675" fill="#07080c"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <circle cx="1010" cy="337" r="150" fill="none" stroke="#141824" stroke-width="28"/>
  <circle cx="1010" cy="337" r="150" fill="none" stroke="#ff4d5e" stroke-width="28" stroke-linecap="round"
    stroke-dasharray="${(942 * score) / 100} 942" transform="rotate(-90 1010 337)"/>
  <text x="1010" y="352" text-anchor="middle" font-family="Space Grotesk, Inter, sans-serif" font-size="88" font-weight="700" fill="#e9edf5">${score}</text>
  <text x="1010" y="400" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" fill="#8d96a9">/ 100 exposed</text>
  <text x="80" y="120" font-family="JetBrains Mono, monospace" font-size="24" letter-spacing="4" fill="#22d3ee">SHOR'S REACH · Q-DAY EXPOSURE</text>
  <text x="80" y="300" font-family="Space Grotesk, Inter, sans-serif" font-size="128" font-weight="700" fill="#ff4d5e">${esc(amount)}</text>
  <text x="80" y="370" font-family="Inter, sans-serif" font-size="40" fill="#e9edf5">of my crypto sits behind public keys</text>
  <text x="80" y="420" font-family="Inter, sans-serif" font-size="40" fill="#e9edf5">already on-chain.</text>
  <text x="80" y="510" font-family="Space Grotesk, Inter, sans-serif" font-size="40" font-weight="700" fill="url(#g)">${esc(headline)}</text>
  <text x="80" y="600" font-family="JetBrains Mono, monospace" font-size="26" fill="#8d96a9">#BuildBeforeQDay · scan yours, no wallet needed</text>
</svg>`;
}

export function ShareCard({ score, exposedUsd, protectedOnQore = false }: { score: number; exposedUsd: number; protectedOnQore?: boolean }) {
  const svg = useMemo(() => cardSvg(score, exposedUsd, protectedOnQore), [score, exposedUsd, protectedOnQore]);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const [busy, setBusy] = useState(false);
  const text = `${exposedUsd > 0 ? usd(exposedUsd, { compact: true }) : "None"} of my crypto is exposed to a future quantum attacker (score ${score}/100).${
    protectedOnQore ? " Now protected on @QoreChain with a post-quantum key." : ""
  } Scan yours: ${location.origin} #BuildBeforeQDay`;

  const download = async () => {
    setBusy(true);
    try {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 675;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "shors-reach.png";
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h3>Share your result</h3>
      <img src={dataUrl} alt={`Share card: score ${score} of 100`} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }} />
      <p className="faint" style={{ fontSize: 13 }}>No addresses or exact amounts are on the card.</p>
      <div className="row">
        <a className="btn primary" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          Share on X
        </a>
        <button className="btn" type="button" onClick={download} disabled={busy}>
          Download PNG
        </button>
      </div>
    </section>
  );
}
