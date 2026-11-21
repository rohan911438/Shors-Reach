# P12 — Security/privacy review + README + AI_USAGE  (target: 30 Nov)

## PROMPT
```
Read: architecture/07-security-privacy.md, tracks/01-quantum-pass-main-track.md, tracks/03-submission-checklist.md,
research/02-competition-analysis.md ("what winning entries do well").

Task P12:
1. Security review of the whole repo (run /security-review or equivalent): secrets, data flows vs the privacy table,
   advisor input validation, contract checks, dependency audit (npm audit --omit=dev). Fix findings; list them in docs/SECURITY_REVIEW.md.
2. README.md (final), sections:
   - One-line pitch + live demo + video link + badges (CI, licence)
   - The problem (3 bullets with sources) · What it does (6 parts) · Screenshots/GIF
   - Quantum Pass requirements table: requirement → how → proof (scaffold command, QoreX, contract address, hybrid tx hash, mint tx hash)
   - How it works (scan rules summary + link to methodology) · Architecture diagram
   - How it's made (stack, kits used: Verified list, create-qorechain-dapp templates, test counts)
   - Run locally · Tests · Deployments (diana addresses) · Privacy · **Limits** (honest) · Licence
3. AI_USAGE.md (final): AI in the product (advisor: model, inputs, guardrails, fallback); AI in the build (prompts/ sequence,
   validation gates, what humans reviewed/decided); share of AI-written vs human-edited code (honest estimate).
4. Copy final docs into docs/ and make sure links work.

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | Zero open high/critical findings | SECURITY_REVIEW.md |
| 2 | Every README claim has proof (link/hash/test count) | 👤 read-through |
| 3 | All README links work | link checker output |
| 4 | Limits section present and honest | 👤 |
| 5 | AI_USAGE.md complete | 👤 |

## IF THE GATE FAILS
```
P12 gate failed on: <items>. Fix; re-run.
```

## Hand-off
Tag `p12-done`.
