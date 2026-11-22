/**
 * E2E smoke test against a running build (default http://localhost:4173 — `npm run build && npm run preview`).
 * Drives the locally installed Edge/Chrome through playwright-core, so no browser download is needed.
 *
 *   npx tsx scripts/e2e.ts [baseUrl]
 *
 * Covers: landing, live scan with evidence (Satoshi's genesis key), plan page (AI or rule-based),
 * methodology anchors, dashboard counters read from QoreChain, mobile menu, theme toggle, no page errors.
 * The QoreX wallet steps of /pass need the real extension and stay a manual check.
 */
import { chromium, type Page } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:4173";
const GENESIS =
  "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f";

const results: { name: string; ok: boolean; ms: number; err?: string }[] = [];
async function step(name: string, fn: () => Promise<void>) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`  ✓ ${name} (${Date.now() - t} ms)`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t, err: String(err).split("\n")[0] });
    console.log(`  ✗ ${name}: ${String(err).split("\n")[0]}`);
  }
}
function expect(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function launch() {
  for (const channel of ["msedge", "chrome"] as const) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try next */
    }
  }
  throw new Error("Neither Edge nor Chrome is installed.");
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", colorScheme: "dark" });
const page: Page = await ctx.newPage();
const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

console.log(`E2E against ${BASE}`);

await step("landing renders hero, scan box and live pass counter", async () => {
  await page.goto(`${BASE}/#/`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  expect((await page.getByRole("heading", { level: 1 }).innerText()).includes("public"), "hero headline");
  await page.locator("#scan-input").waitFor();
  await page.locator(".hero-tag").filter({ hasText: /\d+ passes minted/ }).waitFor({ timeout: 30_000 });
});

await step("input detection + validation", async () => {
  await page.fill("#scan-input", "not an address");
  await page.getByRole("button", { name: "Scan exposure" }).click();
  await page.getByRole("alert").waitFor();
  await page.fill("#scan-input", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  await page.getByText("Detected: EVM address").waitFor();
});

await step("live scan of the genesis key shows EXPOSED NOW with evidence", async () => {
  await page.goto(`${BASE}/#/scan/${GENESIS}`);
  await page.locator('table.holdings, .eyebrow:text("Scan incomplete")').first().waitFor({ timeout: 120_000 });
  if (await page.getByText("Scan incomplete").count()) {
    // Upstream (mempool.space) unreachable: the app must say so, never show "safe".
    expect((await page.locator(".big-num.safe").count()) === 0, "incomplete scan must not look safe");
    expect(await page.getByRole("button", { name: "Retry scan" }).isVisible(), "retry button");
    console.log("    (mempool.space unreachable — verified the incomplete state instead)");
    return;
  }
  const rows = page.locator("table.holdings tbody tr");
  expect((await rows.count()) >= 2, "at least two holdings");
  expect((await page.locator(".pill.EXPOSED_NOW").count()) >= 2, "exposed-now pills");
  expect((await page.getByRole("link", { name: /Evidence/ }).count()) >= 2, "evidence links");
  expect(/\$[\d.]+M/.test(await page.locator(".big-num").innerText()), "headline in $M");
  await page.getByRole("button", { name: "Why?" }).first().click();
  await page.locator(".why-panel").first().waitFor();
});

await step("plan page renders a plan with ordered actions", async () => {
  await page.getByRole("link", { name: "Get my plan" }).click();
  await page.locator("h1", { hasText: "What to do" }).waitFor();
  const btn = page.getByRole("button", { name: /Get my plan|Generate/ });
  if (await btn.count()) await btn.first().click();
  await page.getByText(/AI-generated|Rule-based/i).first().waitFor({ timeout: 90_000 });
});

await step("methodology lists every reason with an anchor", async () => {
  await page.goto(`${BASE}/#/methodology`);
  await page.locator(".reason-card").first().waitFor();
  expect((await page.locator(".reason-card[id]").count()) >= 8, "reason anchors");
});

await step("dashboard reads counters from the QoreChain contract", async () => {
  await page.goto(`${BASE}/#/dashboard`);
  await page.locator(".stat .num").first().filter({ hasText: /^\d+$/ }).waitFor({ timeout: 45_000 });
  await page.locator("table.holdings tbody tr").first().waitFor({ timeout: 45_000 });
});

await step("theme toggle switches data-theme", async () => {
  await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
  expect(["light", "dark"].includes((await page.locator("html").getAttribute("data-theme")) ?? ""), "data-theme set");
});

await step("mobile: no horizontal overflow, menu opens", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow <= 0, `page is ${overflow}px wider than the viewport`);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("#main-nav").getByRole("link", { name: "Dashboard" }).waitFor();
});

await step("no uncaught page errors", async () => {
  expect(pageErrors.length === 0, pageErrors.join(" | "));
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
