/** Screenshot helper: npx tsx scripts/screenshots.ts <url> <outPrefix> <w> <h> <dark|light> [cssSelector…] — scrolls to each selector and saves a viewport PNG. */
import { chromium } from "playwright-core";
const [url, outPrefix, w, h, scheme, ...sels] = process.argv.slice(2);
const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage({ viewport: { width: +w!, height: +h! }, colorScheme: scheme as "dark" | "light" });
await p.goto(url!, { waitUntil: "networkidle" }).catch(() => {});
await p.waitForTimeout(1200);
console.log("overflow", await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
let i = 0;
for (const sel of sels) {
  await p.evaluate((s) => { const el = document.querySelector(s); if (el) window.scrollTo(0, (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 70); }, sel);
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${outPrefix}-${i++}.png` });
}
await b.close();
