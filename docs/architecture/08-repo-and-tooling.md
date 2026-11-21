# 08 — Repo structure, tooling, CI, deploy

## Target repo layout (after the build)
```
shors-reach/                      ← the GitHub repo (this planning folder becomes /docs inside it)
├─ app/                           ← create-qorechain-dapp --template viem-wagmi
│  ├─ src/
│  │  ├─ scan/                    ← scan engine (pure TS, no React)
│  │  │  ├─ btc/ (classify, esplora, pubkeys, siblings, xpub, scan)
│  │  │  ├─ evm/ (chains, rpc, safe, scan)
│  │  │  ├─ qore/ (rest, bech32, scan)
│  │  │  ├─ price/ · score/ · types.ts · index.ts
│  │  │  └─ __fixtures__/ (recorded API JSON)
│  │  ├─ qore/ (config, wallet, pass flow)
│  │  ├─ components/ · pages/ · lib/
│  ├─ api/advise.ts               ← Vercel function
│  ├─ e2e/                        ← Playwright
│  └─ package.json
├─ contracts/                     ← create-qorechain-dapp --template foundry
│  ├─ src/QuantumPass.sol · test/ · script/
├─ deployments/diana.json
├─ docs/  (idea/, tracks/, architecture/, research/, prompts/)
├─ .github/workflows/ci.yml
├─ README.md · AI_USAGE.md · LICENSE (MIT)
```

## Tooling
| Area | Tool |
|---|---|
| Package manager | npm (Node 24 available locally) |
| Unit tests | Vitest (scan engine, advisor) |
| Contract tests | Foundry `forge test` |
| E2E | Playwright + `@qorechain/qorex-wallet-mock` |
| Lint/format | ESLint + Prettier (from template) + `tsc --noEmit` |
| Hosting | Vercel (static app + `/api/advise`) |

## CI (`.github/workflows/ci.yml`)
`npm ci` → `tsc --noEmit` → `vitest run` → `forge test` → `npm run build`. Badge in README with test counts.

## Commit discipline (fest check: "commits made during the fest")
Small commits per prompt step: `feat(scan): btc sibling derivation`, `test(scan): satoshi p2pk fixture`, etc.
Tag after each validated prompt: `p01-done`, `p02-done`, …
