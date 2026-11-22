/**
 * Small UI kit: line icons, count-up numbers, scroll reveal, cursor spotlight.
 * All motion respects prefers-reduced-motion.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- icons (24px grid, 1.6 stroke, round caps)
const PATHS = {
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
  key: "M14.5 9.5a4 4 0 1 1-2.1-3.52M14.5 9.5 21 16v3h-3v-2h-2v-2h-2l-1.6-1.6",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  ghost: "M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6L5 20ZM9.5 11h.01M14.5 11h.01",
  bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z",
  link: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3A4.5 4.5 0 0 0 11 19.4l1-1",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2",
  shield: "M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9 2.3 2.3 4.2-4.6",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  github: "M9 19c-4 1.3-4-2-6-2.5m12 5v-3.4c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.4 5.8 2.7 5.8 2.7a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.1c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2v3.4",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  sun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  atom: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 21c-2.2 0-4-4-4-9s1.8-9 4-9 4 4 4 9-1.8 9-4 9ZM4.2 16.5c-1.1-1.9 1.5-5.5 5.8-8s8.7-2.9 9.8-1-1.5 5.5-5.8 8-8.7 2.9-9.8 1Zm0-9c1.1-1.9 5.5-1.5 9.8 1s6.9 6.1 5.8 8-5.5 1.5-9.8-1-6.9-6.1-5.8-8Z",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------- count-up
/** Animates from 0 to `value` once it scrolls into view. `format` renders the number. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), duration = 1200 }: {
  value: number | null;
  format?: (n: number) => string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (value === null) return;
    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        // Write the text directly: no React re-render per frame.
        const node = ref.current?.firstChild;
        if (node) node.nodeValue = format(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setShown(value);
      };
      raf = requestAnimationFrame(tick);
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  return (
    <span ref={ref} className="tabular">
      {value === null ? "…" : format(shown ?? 0)}
    </span>
  );
}

// ---------------------------------------------------------------- scroll reveal
/** Adds `.in` to every `.reveal` element when it enters the viewport. Call once per page. */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(".reveal:not(.in)")];
    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ---------------------------------------------------------------- spotlight card
/** A card whose border and surface glow follow the pointer. */
export function Spotlight({ children, className = "", style, as: Tag = "div" }: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "a" | "section" | "article";
}) {
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag className={`card spot ${className}`} style={style} onPointerMove={onMove}>
      {children}
    </Tag>
  );
}
