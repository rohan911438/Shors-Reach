/** Dev CLI: npm run scan:live -- <input>  — runs the real scan against live APIs and prints a table. */
import { REASONS, scan } from "../src/scan/index.js";

const input = process.argv[2];
if (!input) {
  console.error("usage: npm run scan:live -- <btc address | pubkey | xpub | 0x | qor1>");
  process.exit(1);
}
const t0 = Date.now();
const r = await scan(input, { onProgress: (e) => (e.type === "info" ? console.error(`  · ${e.message}`) : undefined) });
console.log(`\n${r.inputKind}  score ${r.score}/100 (${r.scoreBasis})  in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
for (const h of r.holdings) {
  const usd = h.usd === null ? "      n/a" : `$${h.usd.toFixed(0).padStart(8)}`;
  console.log(
    `${h.status.padEnd(17)} ${h.chain.padEnd(10)} ${h.format.padEnd(12)} ${h.amount.padStart(16)} ${h.asset.padEnd(6)} ${usd}  ${REASONS[h.reason].title}`,
  );
  if (h.evidence) console.log(`${" ".repeat(18)}-> ${h.evidence.url}`);
}
console.log("\nUSD totals:", Object.fromEntries(Object.entries(r.totals.usd).map(([k, v]) => [k, Math.round(v)])));
if (r.qore) console.log("QoreChain:", r.qore);
for (const s of r.sources.filter((x) => !x.ok)) console.log("source down:", s.source, s.error);
