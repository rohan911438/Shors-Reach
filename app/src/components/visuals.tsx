/**
 * Signature visuals for the landing page.
 * - AsciiOrb: a rotating sphere of public keys drawn as ASCII glyphs; red glyphs are exposed keys.
 * - PassCard: a Quantum Pass card that tilts toward the cursor.
 * - StoryVisual: one SVG that morphs through the four steps of how a key gets exposed.
 * All animation stops under prefers-reduced-motion and while off-screen.
 */
import { useEffect, useRef, type PointerEvent } from "react";

import { reducedMotion } from "./ui.js";

const RAMP = " .:-=+*#%@";

export function AsciiOrb({ points = 900, exposedShare = 0.11 }: { points?: number; exposedShare?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fibonacci sphere + a deterministic "exposed" subset.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = Array.from({ length: points }, (_, i) => {
      const y = 1 - (i / (points - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const h = Math.sin(i * 12.9898) * 43758.5453;
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, exposed: h - Math.floor(h) < exposedShare, phase: (h * 7) % 6.28 };
    });

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let colors = { text: "#f2f2ec", lime: "#c8ff3d", red: "#ff4b33" };
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      colors = {
        text: cs.getPropertyValue("--text").trim() || colors.text,
        lime: cs.getPropertyValue("--accent").trim() || colors.lime,
        red: cs.getPropertyValue("--danger").trim() || colors.red,
      };
    };
    readColors();
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let mx = 0;
    let my = 0;
    const onMove = (e: globalThis.PointerEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(canvas);

    const still = reducedMotion();
    let rotY = 0.6;
    let rotX = -0.25;
    let raf = 0;
    const draw = (t: number) => {
      if (!visible && !still) {
        raf = requestAnimationFrame(draw);
        return;
      }
      rotY += still ? 0 : 0.0022;
      const ry = rotY + mx * 0.35;
      const rx = rotX + my * 0.2;
      const R = Math.min(w, h) * 0.4;
      const cx = w / 2;
      const cy = h / 2;
      const cosY = Math.cos(ry), sinY = Math.sin(ry), cosX = Math.cos(rx), sinX = Math.sin(rx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const fs = Math.max(9, Math.round(R / 26));
      ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of pts) {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const depth = (z2 + 1) / 2; // 0 back .. 1 front
        const scale = 0.75 + depth * 0.4;
        const sx = cx + x1 * R * scale;
        const sy = cy + y2 * R * scale;
        if (p.exposed) {
          const pulse = still ? 1 : 0.65 + 0.35 * Math.sin(t / 420 + p.phase);
          ctx.globalAlpha = (0.35 + depth * 0.65) * pulse;
          ctx.fillStyle = colors.red;
          ctx.fillText(depth > 0.55 ? "@" : "#", sx, sy);
        } else {
          const ch = RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.round(depth * (RAMP.length - 1))))]!;
          ctx.globalAlpha = 0.08 + depth * 0.5;
          ctx.fillStyle = depth > 0.94 ? colors.lime : colors.text;
          ctx.fillText(ch, sx, sy);
        }
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [points, exposedShare]);

  return <canvas ref={ref} role="img" aria-label="A sphere of public keys; the red ones are already exposed on-chain" />;
}

export function PassCard({ score = 72 }: { score?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${px * 22}deg`);
    el.style.setProperty("--rx", `${-py * 18}deg`);
    el.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
    el.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
    el.style.setProperty("--sx", `${px * 120}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    for (const k of ["--ry", "--rx", "--gx", "--gy", "--sx"]) el.style.removeProperty(k);
  };
  return (
    <div className="pcard-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="pcard" ref={ref} style={{ ["--p" as string]: score }} role="img" aria-label="Illustration of a Quantum Pass">
        <div className="pcard-top">
          <span>Quantum Pass · soulbound</span>
          <span>QoreChain</span>
        </div>
        <div className="pcard-mid">
          <div className="pcard-ring">
            <span>{score}</span>
          </div>
          <div className="pcard-title">
            ML-DSA-87
            <small>verified on-chain · 0x0a01</small>
          </div>
        </div>
        <div className="pcard-bot">
          <span>
            qor1·····q8m4
            <br />
            #BuildBeforeQDay
          </span>
          <div className="pcard-chip" />
        </div>
      </div>
    </div>
  );
}

/** Four states: 0 hidden key · 1 key revealed by a spend · 2 one key, many addresses/chains · 3 Shor's algorithm. */
export function StoryVisual({ step }: { step: number }) {
  const on = (s: number | number[]) => ((Array.isArray(s) ? s : [s]).includes(step) ? "sv" : "sv sv-off");
  const fan = [
    [90, 110, "1A1z…"],
    [90, 200, "bc1q…"],
    [90, 290, "3J98…"],
    [90, 380, "bc1p…"],
    [410, 110, "ETH"],
    [410, 200, "Base"],
    [410, 290, "Arb"],
    [410, 380, "BNB"],
  ] as const;
  return (
    <div className="story-visual" aria-hidden="true">
      <span className="label">fig. {String(step + 1).padStart(2, "0")} — attacker's view</span>
      <svg viewBox="0 0 500 500" fill="none" stroke="currentColor" style={{ color: "var(--text)" }}>
        <defs>
          <pattern id="sgrid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0V25" stroke="var(--grid-line)" />
          </pattern>
        </defs>
        <rect width="500" height="500" fill="url(#sgrid)" stroke="none" />

        {/* 0: address = hash of key; key hidden */}
        <g className={on(0)}>
          <rect x="150" y="190" width="200" height="120" rx="14" stroke="var(--border-strong)" fill="var(--surface)" />
          <text x="250" y="232" textAnchor="middle" fill="var(--muted)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            address = HASH(key)
          </text>
          <text x="250" y="270" textAnchor="middle" fill="var(--text)" stroke="none" fontFamily="var(--font-mono)" fontSize="16">
            bc1q·····7kx2
          </text>
          <path d="M235 330h30v26h-30zM240 330v-8a10 10 0 0 1 20 0v8" stroke="var(--accent)" strokeWidth="2" />
          <text x="250" y="390" textAnchor="middle" fill="var(--accent)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            key hidden — safe for now
          </text>
        </g>

        {/* 1: spend reveals the key */}
        <g className={on(1)}>
          <rect x="70" y="150" width="360" height="200" rx="14" stroke="var(--border-strong)" fill="var(--surface)" />
          <text x="94" y="184" fill="var(--muted)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            tx 4a5e1e4b… · input #0
          </text>
          <text x="94" y="222" fill="var(--faint)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            signature 3045022100f3…
          </text>
          <text x="94" y="256" fill="var(--danger)" stroke="none" fontFamily="var(--font-mono)" fontSize="13">
            pubkey 04678afdb0fe5548…
          </text>
          <rect x="88" y="238" width="300" height="28" rx="6" stroke="var(--danger)" strokeDasharray="4 4" />
          <text x="94" y="320" fill="var(--danger)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            ▲ public key now on-chain, forever
          </text>
        </g>

        {/* 2: one key, many addresses & chains */}
        <g className={on(2)}>
          {fan.map(([x, y, l]) => (
            <g key={l}>
              <path d={`M250 250 L${x} ${y}`} stroke="var(--danger)" strokeOpacity="0.5" />
              <rect x={x - 38} y={y - 16} width="76" height="32" rx="8" fill="var(--surface)" stroke="var(--danger)" />
              <text x={x} y={y + 5} textAnchor="middle" fill="var(--danger)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
                {l}
              </text>
            </g>
          ))}
          <circle cx="250" cy="250" r="36" fill="var(--danger)" stroke="none" />
          <text x="250" y="255" textAnchor="middle" fill="#fff" stroke="none" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">
            KEY
          </text>
        </g>

        {/* 3: Shor's algorithm */}
        <g className={on(3)}>
          <circle cx="250" cy="250" r="130" stroke="var(--accent)" strokeDasharray="2 7" />
          <circle cx="250" cy="250" r="90" stroke="var(--accent)" strokeOpacity="0.5" />
          <text x="250" y="200" textAnchor="middle" fill="var(--accent)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            Shor(pubkey)
          </text>
          <text x="250" y="258" textAnchor="middle" fill="var(--text)" stroke="none" fontFamily="var(--font-display)" fontSize="34" fontWeight="700">
            → private key
          </text>
          <text x="250" y="300" textAnchor="middle" fill="var(--danger)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            funds movable by anyone
          </text>
          <text x="250" y="420" textAnchor="middle" fill="var(--muted)" stroke="none" fontFamily="var(--font-mono)" fontSize="12">
            unless moving them needs a post-quantum signature
          </text>
        </g>
      </svg>
    </div>
  );
}
