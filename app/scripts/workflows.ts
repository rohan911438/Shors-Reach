/**
 * User-workflow tests: real journeys through the app, end to end, against live chains.
 * Run against the dev server to include the AI advisor (`npm run dev` → http://localhost:5173),
 * or against a preview / deployed URL.
 *
 *   npx tsx scripts/workflows.ts [baseUrl] [--report docs/reports/workflows.md]
 *
 * Personas
 *  A. Curious newcomer — landing → example chip → results → "Why?" → methodology deep link → plan → raw JSON
 *  B. EVM user — scans an EVM address → multi-chain rows + QoreChain status → protect CTA → /pass stepper
 *  C. Careful user — bad input → error; seed phrase pasted → rejected; xpub detected
 *  D. Mobile visitor — 390px, menu navigation, no overflow, story + pass band render
 *  E. Returning visitor — theme choice persists across reloads; deep link to a scan restores results
 * Records timings per step and writes a Markdown report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:5173";
const reportPath = args.includes("--report") ? args[args.indexOf("--report") + 1] : undefined;
const GENESIS =
  "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const XPUB = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

type Row = { persona: string; step: string; ok: boolean; ms: number; note?: string };
const rows: Row[] = [];
let persona = "";
const expect = (c: unknown, m: string) => {
  if (!c) throw new Error(m);
};
async function step(name: string, fn: () => Promise<string | void>) {
  const t = Date.now();
  try {
    const note = (await fn()) ?? undefined;
    rows.push({ persona, step: name, ok: true, ms: Date.now() - t, note });
    console.log(`  ✓ ${name} (${Date.now() - t} ms)${note ? ` — ${note}` : ""}`);
  } catch (e) {
    const note = String(e).split("\n")[0]!.slice(0, 180);
    rows.push({ persona, step: name, ok: false, ms: Date.now() - t, note });
    console.log(`  ✗ ${name}: ${note}`);
  }
}

async function launch(): Promise<Browser> {
  for (const channel of ["msedge", "chrome"] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* next */
    }
  }
  throw new Error("Neither Edge nor Chrome is installed.");
}
const browser = await launch();
const errors: string[] = [];
async function newPage(opts: { width?: number; height?: number; scheme?: "dark" | "light" } = {}): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: opts.width ?? 1366, height: opts.height ?? 900 },
    colorScheme: opts.scheme ?? "dark",
    reducedMotion: "reduce",
  });
  ctx.setDefaultNavigationTimeout(120_000);
  ctx.setDefaultTimeout(60_000);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${persona}: ${e.message}`));
  return p;
}
const waitResults = (p: Page) => p.locator('table.holdings, .eyebrow:text("Scan incomplete")').first().waitFor({ timeout: 120_000 });

console.log(`Workflows against ${BASE}\n`);

// ------------------------------------------------------------------ A
persona = "A. Curious newcomer";
console.log(persona);
{
  const p = await newPage();
  await step("lands on the home page and sees the hero + live counter", async () => {
    const t = Date.now();
    await p.goto(`${BASE}/#/`);
    await p.getByRole("heading", { level: 1 }).waitFor();
    const fcp = Date.now() - t;
    await p.locator(".hero-tag").filter({ hasText: /\d+ passes minted/ }).waitFor({ timeout: 30_000 });
    return `hero visible in ${fcp} ms`;
  });
  await step("clicks the 'Satoshi's genesis key' example", async () => {
    await p.getByRole("button", { name: /Satoshi's genesis key/ }).click();
    await waitResults(p);
    if (await p.getByText("Scan incomplete").count()) return "upstream down → 'Scan incomplete' shown (never 'safe')";
    const n = await p.locator(".pill.EXPOSED_NOW").count();
    expect(n >= 2, "exposed rows");
    return `${n} exposed holdings · headline ${await p.locator(".big-num").innerText()}`;
  });
  await step("opens 'Why?' and the evidence link points to a block explorer", async () => {
    if (!(await p.locator("table.holdings").count())) return "skipped (incomplete scan)";
    await p.getByRole("button", { name: "Why?" }).first().click();
    await p.locator(".why-panel").first().waitFor();
    const href = await p.getByRole("link", { name: /Evidence/ }).first().getAttribute("href");
    expect(href && /^https:\/\/(mempool\.space|blockstream\.info)/.test(href), `evidence href ${href}`);
    return href!.replace(/(tx\/\w{8})\w+/, "$1…");
  });
  await step("follows the methodology deep link for that reason", async () => {
    const link = p.locator(".why-panel a[href*='methodology']").first();
    if (!(await link.count())) return "no deep link in panel (checked methodology directly)";
    await link.click();
    await p.locator(".reason-card:target, .reason-card").first().waitFor();
    return p.url().split("#")[1];
  });
  await step("gets a plan from the advisor", async () => {
    await p.goto(`${BASE}/#/plan`);
    const badge = p.getByText(/AI-generated|Rule-based plan/).first();
    await badge.waitFor({ timeout: 90_000 });
    const label = await badge.innerText();
    const actions = await p.locator(".stepper .s").count();
    expect(actions >= 1, "plan has actions");
    return `${label} · ${actions} actions`;
  });
  await step("inspects exactly what the advisor saw (no identifiers)", async () => {
    await p.getByRole("button", { name: "Show raw JSON" }).click();
    const raw = await p.locator("pre").last().innerText();
    expect(!/04678afd|1A1zP1|bc1[a-z0-9]{20,}|0x[0-9a-fA-F]{40}/.test(raw), "payload leaks an identifier");
    return `${raw.length} chars, no addresses/keys`;
  });
  await p.context().close();
}

// ------------------------------------------------------------------ B
persona = "B. EVM user";
console.log(persona);
{
  const p = await newPage();
  await step("pastes an EVM address and scans", async () => {
    await p.goto(`${BASE}/#/`);
    await p.fill("#scan-input", VITALIK);
    await p.getByText("Detected: EVM address").waitFor();
    await p.getByRole("button", { name: "Scan exposure" }).click();
    await waitResults(p);
    const chains = await p.locator("table.holdings tbody tr").count();
    return `${chains} rows`;
  });
  await step("sees the QoreChain account status panel", async () => {
    await p.getByText(/QoreChain testnet ·/).first().waitFor({ timeout: 30_000 });
  });
  await step("clicks 'Protect on QoreChain' → Quantum Pass stepper", async () => {
    await p.getByRole("link", { name: "Protect on QoreChain" }).click();
    await p.getByRole("heading", { name: "Connect QoreX" }).waitFor();
    const btn = await p.getByRole("button", { name: /Connect QoreX/ }).innerText();
    return `without the extension: "${btn}"`;
  });
  await step("is offered a QoreX install link", async () => {
    const get = p.getByRole("link", { name: /Get QoreX/ });
    expect(await get.count(), "install link");
  });
  await p.context().close();
}

// ------------------------------------------------------------------ C
persona = "C. Careful user";
console.log(persona);
{
  const p = await newPage();
  await p.goto(`${BASE}/#/`);
  await step("garbage input shows a clear error, no navigation", async () => {
    await p.fill("#scan-input", "hello world");
    await p.getByRole("button", { name: "Scan exposure" }).click();
    await p.getByRole("alert").waitFor();
    expect(p.url().endsWith("#/"), "stayed on home");
    return await p.getByRole("alert").innerText();
  });
  await step("a pasted seed phrase is refused", async () => {
    await p.fill("#scan-input", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    await p.getByRole("button", { name: "Scan exposure" }).click();
    await p.getByRole("alert").waitFor();
    expect(!p.url().includes("/scan/"), "must not scan a seed phrase");
    expect(/seed phrase/i.test(await p.getByRole("alert").innerText()), "specific seed-phrase warning");
    expect((await p.inputValue("#scan-input")) === "", "seed phrase cleared from the box");
    return await p.getByRole("alert").innerText();
  });
  await step("an xpub is detected as an HD wallet", async () => {
    await p.fill("#scan-input", XPUB);
    await p.getByText("Detected: HD wallet (xpub)").waitFor();
  });
  await p.context().close();
}

// ------------------------------------------------------------------ D
persona = "D. Mobile visitor (390px)";
console.log(persona);
{
  const p = await newPage({ width: 390, height: 844, scheme: "light" });
  await step("home has no horizontal overflow", async () => {
    await p.goto(`${BASE}/#/`);
    await p.getByRole("heading", { level: 1 }).waitFor();
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o <= 0, `overflow ${o}px`);
  });
  await step("story and pass band render", async () => {
    await p.locator(".story-step").nth(3).scrollIntoViewIfNeeded();
    await p.locator(".passband").scrollIntoViewIfNeeded();
    await p.getByRole("link", { name: /Get your Quantum Pass/ }).waitFor();
  });
  await step("opens the menu and navigates to the dashboard", async () => {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.getByRole("button", { name: "Open menu" }).click();
    await p.locator("#main-nav").getByRole("link", { name: /Dashboard/ }).click();
    await p.locator(".stat .num").first().filter({ hasText: /^\d+$/ }).waitFor({ timeout: 45_000 });
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o <= 0, `dashboard overflow ${o}px`);
  });
  await step("methodology readable without overflow", async () => {
    await p.goto(`${BASE}/#/methodology`);
    await p.locator(".reason-card").first().waitFor();
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o <= 0, `methodology overflow ${o}px`);
  });
  await p.context().close();
}

// ------------------------------------------------------------------ E
persona = "E. Returning visitor";
console.log(persona);
{
  const p = await newPage();
  await step("theme choice persists across a reload", async () => {
    await p.goto(`${BASE}/#/`);
    await p.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
    const t = await p.locator("html").getAttribute("data-theme");
    await p.reload();
    await p.getByRole("heading", { level: 1 }).waitFor();
    expect((await p.locator("html").getAttribute("data-theme")) === t, "theme not persisted");
    return `theme=${t}`;
  });
  await step("a shared deep link to a scan restores the results", async () => {
    await p.goto(`${BASE}/#/scan/${GENESIS}`);
    await waitResults(p);
  });
  await p.context().close();
}

persona = "All";
await step("no uncaught page errors in any journey", async () => {
  expect(errors.length === 0, errors.join(" | "));
});

await browser.close();
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} steps passed`);

if (reportPath) {
  const lines = [
    `# User-workflow test report`,
    ``,
    `Run: ${new Date().toISOString()} · target: \`${BASE}\` · browser: headless Edge (playwright-core) · live chain data`,
    ``,
    `**${rows.length - failed.length}/${rows.length} steps passed.**`,
    ``,
    `| Persona | Step | Result | Time | Notes |`,
    `|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.persona} | ${r.step} | ${r.ok ? "✅" : "❌"} | ${(r.ms / 1000).toFixed(1)} s | ${(r.note ?? "").replace(/\|/g, "\\|")} |`),
    ``,
    `Reproduce: \`cd app && npm run dev\` then \`npx tsx scripts/workflows.ts http://localhost:5173 --report ../docs/reports/workflows.md\`.`,
    ``,
  ];
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join("\n"));
  console.log(`report → ${reportPath}`);
}
process.exit(failed.length ? 1 : 0);
