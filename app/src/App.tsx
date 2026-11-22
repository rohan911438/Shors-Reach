import { lazy, Suspense, useEffect, useState } from "react";

import { href, useRoute, type Route } from "./lib/router.js";
import { Home } from "./pages/Home.js";
import { Icon } from "./components/ui.js";
import { WalletButton } from "./components/WalletButton.js";
import { QUANTUM_PASS_ADDRESS } from "./qore/quantumPass.js";
import { useWatchlist } from "./watch/store.js";

// Landing is eager; every other page is its own chunk.
const ScanPage = lazy(() => import("./pages/Scan.js").then((m) => ({ default: m.ScanPage })));
const Plan = lazy(() => import("./pages/Plan.js").then((m) => ({ default: m.Plan })));
const Pass = lazy(() => import("./pages/Pass.js").then((m) => ({ default: m.Pass })));
const Dashboard = lazy(() => import("./pages/Dashboard.js").then((m) => ({ default: m.Dashboard })));
const Watch = lazy(() => import("./pages/Watch.js").then((m) => ({ default: m.Watch })));
const Developers = lazy(() => import("./pages/Developers.js").then((m) => ({ default: m.Developers })));
const Methodology = lazy(() => import("./pages/Methodology.js").then((m) => ({ default: m.Methodology })));

function PageLoading() {
  return (
    <div className="card" aria-busy="true">
      <div className="scanline" />
    </div>
  );
}

const NAV: { label: string; route: Route; match: Route["name"][] }[] = [
  { label: "Scan", route: { name: "home" }, match: ["home", "scan"] },
  { label: "Plan", route: { name: "plan" }, match: ["plan"] },
  { label: "Watchlist", route: { name: "watch" }, match: ["watch"] },
  { label: "Quantum Pass", route: { name: "pass" }, match: ["pass"] },
  { label: "Dashboard", route: { name: "dashboard" }, match: ["dashboard"] },
  { label: "Methodology", route: { name: "methodology" }, match: ["methodology"] },
  { label: "API", route: { name: "developers" }, match: ["developers"] },
];

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("theme") ?? "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem("theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  const toggle = () => {
    const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "light" : "dark");
  };
  return [theme, toggle];
}

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return scrolled;
}

export function App() {
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();
  const scrolled = useScrolled();
  const [menu, setMenu] = useState(false);
  const unread = useWatchlist().reduce((n, i) => n + i.unread, 0);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, [route.name]);
  const dark = theme ? theme === "dark" : typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className={`header ${scrolled ? "scrolled" : ""} ${menu ? "open" : ""}`}>
        <div className="wrap">
          <a className="brand" href="#/" aria-label="Shor's Reach home">
            <span className="brand-mark">
              <Icon name="atom" size={16} />
            </span>
            Shor's Reach
          </a>
          <nav className="nav" aria-label="Main" id="main-nav">
            {NAV.map((n, i) => (
              <a key={n.label} href={href(n.route)} aria-current={n.match.includes(route.name) ? "page" : undefined}>
                {n.label}
                {n.route.name === "watch" && unread > 0 ? (
                  <span className="nav-badge" aria-label={`${unread} new alerts`}>
                    {unread}
                  </span>
                ) : (
                  <sup>0{i + 1}</sup>
                )}
              </a>
            ))}
          </nav>
          <div className="spacer" />
          <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} theme`} title="Toggle theme">
            <Icon name={dark ? "sun" : "moon"} size={17} />
          </button>
          {route.name !== "home" && route.name !== "scan" ? null : (
            <a className="btn small cta-scan" href="#/pass">
              Get a Quantum Pass
            </a>
          )}
          <div className="connect">
            <WalletButton />
          </div>
          <button
            className="icon-btn menu-btn"
            type="button"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="main-nav"
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? "close" : "menu"} size={18} />
          </button>
        </div>
      </header>

      <main className={route.name === "home" ? "" : "wrap"} id="main" key={route.name}>
        <Suspense fallback={<PageLoading />}>
          {route.name === "home" && <Home />}
          {route.name === "scan" && <ScanPage input={route.input} />}
          {route.name === "plan" && <Plan />}
          {route.name === "pass" && <Pass />}
          {route.name === "dashboard" && <Dashboard />}
          {route.name === "watch" && <Watch />}
          {route.name === "developers" && <Developers />}
          {route.name === "methodology" && <Methodology anchor={route.anchor} />}
        </Suspense>
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="foot-cta">
            <h2>
              Build before <em className="serif lime">Q-Day.</em>
            </h2>
            <div className="row">
              <a className="btn primary" href="#/" onClick={() => setTimeout(() => document.getElementById("scan-input")?.focus(), 50)}>
                <Icon name="scan" size={16} /> Scan an address
              </a>
              <a className="btn" href="#/methodology">
                Read the methodology <Icon name="arrow" size={16} />
              </a>
            </div>
          </div>
          <div className="foot-grid">
            <div className="foot-brand">
              <a className="brand" href="#/">
                <span className="brand-mark">
                  <Icon name="atom" size={16} />
                </span>
                Shor's Reach
              </a>
              <p className="muted">
                See your crypto the way a quantum attacker sees it — then move it under post-quantum protection.
              </p>
              <span className="pill PROTECTED">We never ask for seeds or private keys</span>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#/">Scan</a>
              <a href="#/plan">Plan</a>
              <a href="#/pass">Quantum Pass</a>
              <a href="#/dashboard">Dashboard</a>
            </div>
            <div>
              <h4>Trust</h4>
              <a href="#/methodology">Methodology &amp; limits</a>
              <a href={`https://explore.qore.network/address/${QUANTUM_PASS_ADDRESS}`} target="_blank" rel="noreferrer">
                Contract on explorer
              </a>
              <a href="https://github.com/rohan911438/Shors-Reach/blob/main/docs/SECURITY_REVIEW.md" target="_blank" rel="noreferrer">
                Security review
              </a>
              <a href="https://github.com/rohan911438/Shors-Reach/blob/main/AI_USAGE.md" target="_blank" rel="noreferrer">
                AI usage
              </a>
            </div>
            <div>
              <h4>Build</h4>
              <a href="https://github.com/rohan911438/Shors-Reach" target="_blank" rel="noreferrer">
                <Icon name="github" size={15} /> GitHub
              </a>
              <a href="https://build.qorechain.io" target="_blank" rel="noreferrer">
                QoreChain Developer Fest
              </a>
              <span className="faint">MIT licensed</span>
            </div>
          </div>
          <div className="wordmark" aria-hidden="true">
            Shor's Reach
          </div>
          <div className="foot-bottom">
            <span>© 2026 Shor's Reach · MIT · built for #BuildBeforeQDay</span>
            <span>Testnet demo · not financial advice</span>
          </div>
        </div>
      </footer>
    </>
  );
}
