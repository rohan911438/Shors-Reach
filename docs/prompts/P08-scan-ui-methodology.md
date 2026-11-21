# P08 — Scan UI, results, methodology  (target: 26–27 Nov)

## PROMPT
```
Read: architecture/05-frontend.md, idea/04-user-flows.md (Flow A), app/src/scan/index.ts (public API).

Task P08:
1. Add Tailwind + React Router; layout with header (logo, nav: Scan · Pass · Dashboard · Methodology, QoreX connect), light/dark.
2. Landing "/": headline, ScanInput with autodetect + validation, example chips (genesis pubkey "Satoshi's coins",
   vitalik.eth address, a Taproot address), live counter placeholder (wired in P11).
3. "/scan": input via URL fragment; ScanProgress (per-source live states from orchestrator events); ExposureHeadline;
   HoldingsTable with status pills, USD, reason, evidence links, "Why?" drawer (reasons.ts text); SourceHealth notice;
   questionnaire (3 questions) that re-scores UNKNOWN rows; CTAs to /plan and /pass.
4. "/methodology": one section per ReasonCode + data sources + limits + privacy (from architecture docs). Anchors used by "Why?" links.
5. Remove the /dev page from P02 (keep code under src/qore).
6. Component tests (Vitest + Testing Library) for ScanInput detection and HoldingsTable rendering from a fixture ScanResult.
7. Responsive check at 375 px; no horizontal scroll.

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | Scanning each example chip shows correct headline + rows | 👤 + screenshots |
| 2 | Every red row has a working evidence link and "Why?" text | 👤 spot-check 5 rows |
| 3 | Input never appears in network requests to our own origin | DevTools network tab 👤 |
| 4 | 375 px layout OK | screenshot |
| 5 | Component tests pass; build + tsc clean | output |

## IF THE GATE FAILS
```
P08 gate failed on: <items>. Fix; re-run.
```

## Hand-off
Tag `p08-done`.
