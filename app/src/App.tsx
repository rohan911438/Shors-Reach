import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";

import { href, useRoute, type Route } from "./lib/router.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Home } from "./pages/Home.js";
import { Methodology } from "./pages/Methodology.js";
import { Pass } from "./pages/Pass.js";
import { Plan } from "./pages/Plan.js";
import { ScanPage } from "./pages/Scan.js";
import { QUANTUM_PASS_ADDRESS } from "./qore/quantumPass.js";

const NAV: { label: string; route: Route; match: Route["name"][] }[] = [
  { label: "Scan", route: { name: "home" }, match: ["home", "scan"] },
  { label: "Plan", route: { name: "plan" }, match: ["plan"] },
  { label: "Quantum Pass", route: { name: "pass" }, match: ["pass"] },
  { label: "Dashboard", route: { name: "dashboard" }, match: ["dashboard"] },
  { label: "Methodology", route: { name: "methodology" }, match: ["methodology"] },
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

export function App() {
  const route = useRoute();
  const [, toggleTheme] = useTheme();

  return (
    <>
      <header className="header">
        <div className="wrap">
          <a className="brand" href="#/">
            <img src="/favicon.svg" alt="" />
            Shor's Reach
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <a key={n.label} href={href(n.route)} aria-current={n.match.includes(route.name) ? "page" : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="spacer" />
          <button className="icon-btn" type="button" onClick={toggleTheme} aria-label="Toggle light/dark theme" title="Toggle theme">
            ◐
          </button>
          <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} />
        </div>
      </header>

      <main className="wrap">
        {route.name === "home" && <Home />}
        {route.name === "scan" && <ScanPage input={route.input} />}
        {route.name === "plan" && <Plan />}
        {route.name === "pass" && <Pass />}
        {route.name === "dashboard" && <Dashboard />}
        {route.name === "methodology" && <Methodology anchor={route.anchor} />}
      </main>

      <footer className="footer">
        <div className="wrap">
          <span>
            Shor's Reach · built for the QoreChain Developer Fest <b>#BuildBeforeQDay</b> · MIT
          </span>
          <span className="row" style={{ gap: 18 }}>
            <a href="https://github.com/rohan911438/Shors-Reach" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={`https://explore.qore.network/address/${QUANTUM_PASS_ADDRESS}`} target="_blank" rel="noreferrer">
              Contract
            </a>
            <a href="#/methodology">Methodology &amp; limits</a>
            <span>We never ask for seeds or private keys.</span>
          </span>
        </div>
      </footer>
    </>
  );
}
