# P06 — Pricing, scoring, evidence, orchestrator  (target: 25 Nov)

## PROMPT
```
Read: architecture/02-scan-engine.md §4 (output model), architecture/06-ai-advisor.md (anonymised summary format).

Task P06:
1. price/coingecko.ts: batch price fetch for needed ids; cache 5 min; failure → usd null (never 0).
2. score/score.ts: totals per Status in USD; headline score = round(100 × EXPOSED_NOW_usd / total_usd);
   if no USD → count-weighted + flag; enforce invariant "EXPOSED_NOW requires evidence" (throw in dev, downgrade to UNKNOWN in prod).
3. scan/index.ts orchestrator: scan(input, options) → detects input type (btc address | pubkey | xpub | 0x | qor1),
   runs relevant scanners, merges, prices, scores; emits progress events per source (for the UI); returns ScanResult.
   For 0x input also run the QoreChain scan (same 20 bytes).
4. score/summary.ts: toAnonymisedSummary(result, questionnaire) → exactly the advisor input schema (no addresses, txids,
   exact amounts; USD rounded to 2 significant figures; max 50 holdings). Add a test that fails if any string in the
   output matches address/txid/xpub patterns.
5. score/reasons.ts: ReasonCode → { title, oneLiner, methodologyAnchor } (used by UI + methodology page).
6. CLI: npm run scan:live -- <input> prints a table + headline (dev tool, also handy for the video).

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | All tests pass offline; coverage of src/scan ≥ 80% lines | `npx vitest run --coverage` |
| 2 | Anonymiser leak test passes | test |
| 3 | Price failure → usd null and labelled | test |
| 4 | Every ReasonCode has text | test iterating the enum |
| 5 | Live CLI on 3 inputs (genesis pubkey, vitalik.eth, P02 qor1) | outputs pasted |

## IF THE GATE FAILS
```
P06 gate failed on: <items>. Fix; re-run gate.
```

## Hand-off
Tag `p06-done`. The scan engine is now feature-complete — freeze its public API (types.ts, index.ts).
