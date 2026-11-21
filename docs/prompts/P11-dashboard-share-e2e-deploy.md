# P11 — Dashboard, share card, polish, E2E, deploy  (target: 29 Nov)

## PROMPT
```
Read: architecture/05-frontend.md, idea/02-solution.md (part 6), tracks/02-side-awards.md (People's Choice).

Task P11:
1. "/dashboard": read QuantumPass counters + PassMinted events (viem getLogs, paged) → total passes, ≈ exposed USD
   now attested (from buckets, labelled self-reported), split by chain/score bucket; link to contract on explorer.
   Landing counter wired to the same source.
2. ShareCard: 1200×675 image (SVG → PNG via canvas) with score, "$X exposed → now protected on QoreChain",
   #BuildBeforeQDay, no addresses; "Share on X" intent link + download.
3. Final product name decision (idea/02-solution.md options) → apply to UI, metadata, favicon, OG tags.
4. Polish: loading skeletons, empty/error states, accessibility (labels, contrast, keyboard), 375 px.
5. Full E2E suite (scan → plan → pass with mock wallet) in CI.
6. Deploy to Vercel (production): env vars set (ANTHROPIC_API_KEY, ADVISOR_MODEL); verify /api/advise works in prod.

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | Live URL loads in a fresh incognito window; scan works | 👤 |
| 2 | Dashboard numbers match on-chain reads | compare with cast call |
| 3 | Share card renders, no addresses on it | 👤 |
| 4 | CI green (unit + contract + E2E + build) | GitHub Actions |
| 5 | Lighthouse accessibility ≥ 90 | report |

## IF THE GATE FAILS
```
P11 gate failed on: <items>. Fix; if time-critical apply cut list items 1 and 5. Re-run.
```

## Hand-off
Tag `p11-done`. Feature freeze after this prompt.
