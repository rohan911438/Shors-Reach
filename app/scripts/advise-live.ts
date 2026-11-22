/** Live advisor check: runs the real model on the three fixture summaries. Needs GEMINI_API_KEYS in app/.env. */
import { readFileSync } from "node:fs";
import { advise, parseKeys } from "../src/advisor/server.js";
import { SUMMARIES } from "../src/advisor/fixtures.js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const [name, s] of Object.entries(SUMMARIES)) {
  const t = Date.now();
  const r = await advise(s, { apiKeys: parseKeys(env.GEMINI_API_KEYS, env.GEMINI_API_KEY), model: env.ADVISOR_MODEL, log: console.log });
  console.log(`\n## ${name} — source=${r.source}${r.fallbackReason ? ` (${r.fallbackReason})` : ""} ${Date.now() - t}ms`);
  console.log(JSON.stringify(r.plan, null, 2));
}
