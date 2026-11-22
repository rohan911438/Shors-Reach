/** Live Q&A check: real model, fixture summaries, typical questions. Needs GEMINI_API_KEYS in app/.env. */
import { readFileSync } from "node:fs";
import { ask } from "../src/advisor/ask.js";
import { parseKeys } from "../src/advisor/server.js";
import { SUMMARIES } from "../src/advisor/fixtures.js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const QUESTIONS = ["Why is my Taproot address red?", "What do I do with a Ledger?", "Which coin should I buy now?"];
const summary = Object.values(SUMMARIES)[0]!;
let ai = 0;
for (const question of QUESTIONS) {
  const t = Date.now();
  const r = await ask({ summary, question }, { apiKeys: parseKeys(env.GEMINI_API_KEYS, env.GEMINI_API_KEY), model: env.ADVISOR_MODEL, log: console.log });
  if (r.source === "ai") ai++;
  console.log(`\n## ${question} — source=${r.source}${r.fallbackReason ? ` (${r.fallbackReason})` : ""} ${Date.now() - t}ms\n${r.answer}\nfollow-ups: ${r.followUps.join(" | ")}`);
}
console.log(`\n${ai}/${QUESTIONS.length} answered by the model`);
