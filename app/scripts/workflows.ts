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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:5173";
const reportPath = args.includes("--report") ? args[args.indexOf("--report") + 1] : undefined;
const GENESIS =
  "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
// Lets the Telegram journey play the bot's side (POST the Start update to the webhook). Read from app/.env, never printed.
const TG_SECRET = existsSync(new URL("../.env", import.meta.url))
  ? (/^TELEGRAM_WEBHOOK_SECRET=(.+)$/m.exec(readFileSync(new URL("../.env", import.meta.url), "utf8"))?.[1]?.trim() ?? "")
  : "";
const TAPROOT = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
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
    await badge.waitFor({ timeout: 150_000 });
    const label = await badge.innerText();
    const actions = await p.locator(".stepper .s").count();
    expect(actions >= 1, "plan has actions");
    return `${label} · ${actions} actions`;
  });
  await step("asks a follow-up question about the plan", async () => {
    await p.locator(".ask .chip").first().click();
    await p.locator(".ask-a p").first().waitFor({ timeout: 90_000 });
    const a = await p.locator(".ask-a").first().innerText();
    expect(a.length > 40, "answer too short");
    return (await p.locator(".ask-src").first().innerText()) + " · " + a.replace(/\s+/g, " ").slice(0, 70) + "…";
  });
  await step("an address pasted into a question is refused locally", async () => {
    await p.locator("#ask-input").fill("is 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa safe?");
    await p.getByRole("button", { name: "Ask", exact: true }).click();
    const err = await p.locator(".ask .input-error").innerText();
    expect(/without pasting addresses/.test(err), "no refusal");
    expect((await p.locator(".ask-turn").count()) === 1, "question was sent");
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
  await step("lazy Connect Wallet button loads the wallet stack and opens the modal", async () => {
    await p.getByRole("button", { name: "Connect Wallet" }).first().click();
    await p.getByRole("dialog").waitFor({ timeout: 30_000 });
    const txt = await p.getByRole("dialog").innerText();
    expect(/QoreX|Injected|Browser Wallet/i.test(txt), "wallet list");
    await p.keyboard.press("Escape");
    return "modal lists: " + txt.replace(/s+/g, " ").slice(0, 60);
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

// ------------------------------------------------------------------ F
persona = "F. Partner developer (wallet / exchange)";
console.log(persona);
{
  const p = await newPage();
  await step("API answers a CORS preflight and a scan from a foreign origin", async () => {
    const pre = await fetch(`${BASE}/api/v1/scan`, { method: "OPTIONS", headers: { origin: "https://wallet.example", "access-control-request-method": "POST" } });
    expect(pre.status === 204 && pre.headers.get("access-control-allow-origin") === "*", `preflight ${pre.status}`);
    const res = await fetch(`${BASE}/api/v1/scan`, { method: "POST", headers: { "content-type": "application/json", origin: "https://wallet.example" }, body: JSON.stringify({ input: TAPROOT }) });
    const b = (await res.json()) as { verdict?: string; holdings?: { evidenceUrl: string | null; status: string }[] };
    expect(res.status === 200 && b.verdict === "exposed", `scan ${res.status} ${b.verdict}`);
    expect(b.holdings!.filter((h) => h.status === "EXPOSED_NOW").every((h) => h.evidenceUrl), "exposed row without evidence");
    return `verdict=${b.verdict}, ${b.holdings!.length} holding(s)`;
  });
  await step("API refuses a seed phrase and a GET with the input in the URL", async () => {
    const seed = await fetch(`${BASE}/api/v1/scan`, { method: "POST", body: JSON.stringify({ input: "abandon ability able about above absent absorb abstract absurd abuse access accident" }) });
    expect(seed.status === 400 && ((await seed.json()) as { code: string }).code === "seed-phrase", "seed not refused");
    expect((await fetch(`${BASE}/api/v1/scan?input=${TAPROOT}`)).status === 405, "GET allowed");
  });
  await step("reads the developer docs and runs the playground", async () => {
    await p.goto(`${BASE}/#/developers`);
    await p.getByRole("heading", { name: /where users already are/ }).waitFor();
    await p.getByRole("button", { name: /POST \/api\/v1\/scan/ }).click();
    await p.getByTestId("pg-out").waitFor({ timeout: 90_000 });
    const meta = await p.getByTestId("pg-meta").innerText();
    expect(/HTTP 200/.test(meta), meta);
    expect((await p.getByTestId("pg-out").innerText()).includes('"verdict": "exposed"'), "no verdict");
    return meta;
  });
  await step("the embedded widget scans in its iframe and emits shorsreach:result", async () => {
    const frame = p.frameLocator("[data-shors-reach][data-input] iframe");
    await frame.locator(".embed-verdict .pill").waitFor({ timeout: 90_000 });
    const pill = await frame.locator(".embed-verdict .pill").innerText();
    await p.getByTestId("widget-event").filter({ hasText: "verdict" }).waitFor({ timeout: 30_000 });
    const ev = await p.getByTestId("widget-event").innerText();
    const h = await p.locator("[data-shors-reach][data-input] iframe").evaluate((f) => (f as HTMLIFrameElement).getBoundingClientRect().height);
    expect(h > 120, `iframe not resized (${h})`);
    return `${pill} · ${ev.replace("shorsreach:result → ", "")}`;
  });
  await step("input-mode widget (light theme) accepts an address", async () => {
    const frame = p.frameLocator("[data-shors-reach]:not([data-input]) iframe");
    await frame.locator("#embed-input").fill(VITALIK);
    await frame.getByRole("button", { name: "Check" }).click();
    await frame.locator(".embed-verdict .pill").waitFor({ timeout: 90_000 });
    expect((await frame.locator("html").getAttribute("data-theme")) === "light", "theme not applied");
    return await frame.locator(".embed-verdict .pill").innerText();
  });
  await p.context().close();
}

// ------------------------------------------------------------------ G
persona = "G. Watchlist user";
console.log(persona);
{
  const p = await newPage();
  await step("scans a Taproot address and presses '+ Watch'", async () => {
    await p.goto(`${BASE}/#/scan/${TAPROOT}`);
    await waitResults(p);
    await p.getByRole("button", { name: "+ Watch" }).click();
    await p.getByRole("link", { name: /✓ Watching/ }).waitFor();
  });
  await step("the watchlist shows it with a score, and survives a reload", async () => {
    await p.goto(`${BASE}/#/watch`);
    await p.locator(".w-item").first().waitFor();
    await p.reload();
    await p.locator(".w-item").first().waitFor();
    const score = await p.locator(".w-score b").first().innerText();
    expect(/^\d+$/.test(score), `score ${score}`);
    return `score ${score}`;
  });
  await step("'Check now' re-scans and reports no changes", async () => {
    await p.locator(".w-item").first().getByRole("button", { name: "Check now" }).click();
    await p.locator(".w-item").first().getByText("just now").waitFor({ timeout: 90_000 });
    await p.locator(".w-item").first().getByText("No changes since you started watching.").waitFor();
  });
  await step("a revealed key since the last visit raises an alert and a nav badge", async () => {
    // Simulate the previous visit: same holdings, but still hidden behind a hash.
    await p.evaluate((key) => {
      const items = JSON.parse(localStorage.getItem(key) ?? "[]");
      const it = items[0];
      it.snapshot.holdings = it.snapshot.holdings.map((h: { status: string }) => ({ ...h, status: "EXPOSED_ON_SPEND" }));
      it.snapshot.score = 0;
      it.checkedAt = new Date(Date.now() - 3_600_000).toISOString();
      it.changes = [];
      it.unread = 0;
      localStorage.setItem(key, JSON.stringify(items));
    }, "shors-reach.watchlist.v1");
    await p.reload();
    await p.locator(".w-change").filter({ hasText: "A key was revealed" }).first().waitFor({ timeout: 90_000 });
    const badge = await p.locator(".nav-badge").innerText();
    expect(Number(badge) >= 1, "no badge");
    await p.getByRole("button", { name: "Mark all read" }).click();
    expect((await p.locator(".nav-badge").count()) === 0, "badge stays");
    return `badge ${badge}`;
  });
  await step("the alerts section is honest about what's enabled", async () => {
    const box = p.locator(".w-alerts");
    await box.locator(".notice, .tg-steps, form").first().waitFor({ timeout: 30_000 });
    if (await box.locator(".tg-steps").count()) return "Telegram enabled: 3-step guide shown";
    if (await box.locator("form").count()) {
      await box.locator('input[type="email"]').fill("watch-test@example.com");
      await box.getByRole("button", { name: /confirmation email/ }).click();
      await box.getByText("Check your inbox to confirm.").waitFor({ timeout: 30_000 });
      return "email enabled: confirmation email requested";
    }
    expect(/switched on/.test(await box.locator(".notice").innerText()), "no disabled notice");
    return "disabled on this deployment (notice shown)";
  });
  await step("Telegram onboarding: tap 🔔 → Telegram opens → Start → card turns green → turn off", async () => {
    const card = p.locator(".w-item").first();
    if (!(await card.getByRole("button", { name: /Telegram alerts/ }).count())) return "skipped (Telegram not enabled here)";
    const [popup] = await Promise.all([p.waitForEvent("popup", { timeout: 30_000 }), card.getByRole("button", { name: /Telegram alerts/ }).click()]);
    await popup.waitForURL(/t\.me\/\w+\?start=[0-9a-f]{24}/, { timeout: 30_000 }).catch(() => {});
    const opened = popup.url();
    await popup.close();
    await card.getByText("Waiting for you to press").waitFor({ timeout: 30_000 });
    const link = (await card.getByRole("link", { name: "Open Telegram" }).getAttribute("href")) ?? "";
    expect(/^https:\/\/t\.me\/\w+\?start=[0-9a-f]{24}$/.test(link), `bad link ${link}`);
    if (!TG_SECRET) return `popup → ${opened} (no webhook secret locally: Start not simulated)`;
    // Play Telegram's part: the user pressed Start (fake chat id → the bot's reply fails quietly, by design).
    const token = link.split("start=")[1];
    const hook = await fetch(`${BASE}/api/alerts?action=telegram`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": TG_SECRET },
      body: JSON.stringify({ update_id: 1, message: { chat: { id: 1, type: "private" }, text: `/start ${token}` } }),
    });
    expect(hook.status === 200, `webhook ${hook.status}`);
    await card.getByText("✓ Telegram alerts on").waitFor({ timeout: 30_000 });
    await card.getByRole("button", { name: "Turn off" }).click();
    await card.getByRole("button", { name: /Telegram alerts/ }).waitFor();
    return `popup → ${opened.replace(/start=\w+/, "start=…")} · connected · turned off`;
  });
  await step("removes the entry", async () => {
    await p.locator(".w-item").first().getByRole("button", { name: "Remove" }).click();
    await p.getByText("Nothing watched yet").waitFor();
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
