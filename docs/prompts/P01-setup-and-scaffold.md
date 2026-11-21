# P01 — Setup, accounts, scaffold  (target: 21–22 Nov)

## Goal
A clean repo scaffolded with `create-qorechain-dapp` (app + contracts), MIT licence, first commits, dev server running,
and the human's fest registration complete.

## 👤 Manual steps first (human)
1. Install **QoreX** (browser extension) → switch to **Testnet** → back up the seed offline.
2. Sign in at https://dashboard.qorechain.io → **Faucet** → request test QOR to your qor1 address.
3. https://build.qorechain.io/start → GitHub sign-in → details (18+) → connect X → connect QoreX (proof tx registers PQ key).
4. Create an empty **public** GitHub repo `shors-reach` (no README) and share the URL.

## PROMPT
```
Read docs: README.md, architecture/01-overview.md, architecture/08-repo-and-tooling.md, tracks/01-quantum-pass-main-track.md.

Task P01 — scaffold the project:
1. In a new folder ../shors-reach (sibling of this planning folder), run:
   npx create-qorechain-dapp@0.14.0 app --template viem-wagmi --network testnet --package-manager npm --yes
   npx create-qorechain-dapp@0.14.0 contracts --template foundry --network testnet --yes
   (If the CLI layout differs, adapt but keep app/ and contracts/ as separate folders. Record the exact commands used.)
2. git init; FIRST commit = untouched scaffold output ("chore: scaffold with create-qorechain-dapp (viem-wagmi + foundry)").
3. Add: MIT LICENSE (holder = team name), .gitignore (node_modules, .env*, out/, cache/, dist/), .editorconfig,
   root README stub, docs/ (copy idea/, tracks/, architecture/, research/, prompts/ from the planning folder).
4. app: ensure `npm run dev`, `npm run build`, `npx tsc --noEmit` work. Add Vitest with one smoke test.
5. contracts: ensure `forge build` and `forge test` work (install Foundry if missing; on Windows use WSL or foundryup via Git Bash; report what you did).
6. Add .github/workflows/ci.yml (npm ci, tsc, vitest, build, forge test).
7. Add git remote (URL from human), push, small commits per step.
Do NOT start any feature work.

Then run the VALIDATION GATE below and report each item PASS/FAIL with evidence.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | Scaffold commit exists and is first | `git log --reverse --oneline | head -3` |
| 2 | `@qorechain/*` deps present | `grep -r "@qorechain" app/package.json` |
| 3 | App builds | `npm run build` exit 0 |
| 4 | Types clean | `npx tsc --noEmit` exit 0 |
| 5 | Unit test runner works | `npx vitest run` ≥1 passed |
| 6 | Contracts build + test | `forge test` exit 0 |
| 7 | LICENSE is MIT and detected | GitHub repo page shows "MIT license" 👤 |
| 8 | No secrets committed | `git ls-files | grep -i env` → only `.env.example` |
| 9 | Dev server renders QoreX connect button | screenshot / human check 👤 |
| 10 | 👤 Fest registration complete (GitHub + X + QoreX) | build.qorechain.io/me shows complete |
| 11 | 👤 QoreChain Build GitHub App installed on repo | GitHub → Settings → Integrations |

## IF THE GATE FAILS
```
P01 gate failed on: <items>. Diagnose root cause (read the scaffold README in node_modules/create-qorechain-dapp if needed),
fix minimally, re-run the full gate, report again. Do not change templates' core wiring unless required.
```

## Hand-off to P02
Commit, tag `p01-done`, update PROGRESS.md. Note in the report: exact scaffold commands and any deviations.
