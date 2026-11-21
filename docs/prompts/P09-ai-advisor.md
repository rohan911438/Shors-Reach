# P09 — AI advisor  (target: 27 Nov)

## PROMPT
```
Read: architecture/06-ai-advisor.md, app/src/scan/score/summary.ts. Load the claude-api skill before writing API code.

Task P09:
1. app/api/advise.ts (Vercel Node function): validate body against the anonymised schema (zod); reject anything with
   address/txid/xpub-like strings; call the Anthropic Messages API (model from ADVISOR_MODEL, default claude-opus-5-5)
   with the system prompt rules from the spec and a JSON output schema; validate response; retry once; rate-limit per IP.
2. app/src/advisor/fallback.ts: deterministic rule-based plan from the same summary (used if API fails or no key).
3. "/plan" page: shows summary, prioritised actions, stop-doing, unknowns, QoreChain note; "not financial advice" note;
   badge "AI-generated" vs "rule-based fallback".
4. Tests: schema validation, leak rejection, fallback output for 3 fixture summaries, API mocked.
5. .env.example: ANTHROPIC_API_KEY=, ADVISOR_MODEL=claude-opus-5-5.
6. Start AI_USAGE.md (draft): what AI does in the product (advisor) and how AI was used to build (prompts/ folder, gates, human review).

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | Real call returns valid plan for 3 fixture summaries | `vercel dev` / local run output |
| 2 | Payload with an address is rejected (400) | test + curl |
| 3 | API key missing → fallback plan renders | 👤 |
| 4 | Plans are calm, correct, no seed requests, no shilling | 👤 read all 3 |
| 5 | Tests pass | output |

## IF THE GATE FAILS
```
P09 gate failed on: <items>. Tune the system prompt / schema; re-run.
```

## Hand-off
Tag `p09-done`.
