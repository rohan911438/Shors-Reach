# Shor's Reach

> **See your crypto the way a quantum attacker sees it — then lock your QoreChain account before they can.**

[![CI](https://github.com/rohan911438/Shors-Reach/actions/workflows/ci.yml/badge.svg)](https://github.com/rohan911438/Shors-Reach/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)

Entry for the **QoreChain Developer Fest — "Build Before Q-Day"** · Track: **Quantum Pass** · also applying: Best AI-Native Build, People's Choice.

**Live demo:** [shors-reach.vercel.app](https://shors-reach.vercel.app) · **Video:** _to be added_ · **Cover:** [docs/cover.png](docs/cover.png) · **Contract:** [`0x4f54…56df` on qorechain-diana](https://explore.qore.network/address/0x4f54b69693458523223504b48fa7cd44657a56df)

---

## The problem

- **~6.3M BTC (~31% of supply) sits behind public keys that are already on-chain** — long-exposure coins a quantum computer could attack at leisure (Glassnode, Oct 2026; Project Eleven's tracker says ~6.9M). Sources in [docs/research/03](docs/research/03-quantum-threat-research.md).
- **Holders can't see it.** Address checkers look at one address; the exposure is a property of the *key* — reused across seven Bitcoin address forms, every EVM chain, and Satoshi-era outputs that have no address at all.
- **There is no fix on their chains today.** BIP-360 is a draft; Ethereum's post-quantum accounts target ~2029. QoreChain requires a hybrid secp256k1 + ML-DSA-87 signature on every native transaction **now** — but an account that hasn't registered its PQ key is as weak as any other.

## What it does

1. **Key-level exposure scan** — Bitcoin address / public key / xpub, any `0x…` (7 EVM chains) or `qor1…`. Derives all 7 sibling forms of each key (P2PK c/u, P2PKH c/u, P2WPKH, P2SH-P2WPKH, BIP-86 Taproot), finds raw-key outputs by script hash, applies the cross-chain EVM rule, Safe owners, EIP-7702. Runs in the browser.
2. **Evidence for every red row** — each *Exposed now* verdict links to the transaction that revealed the key. No evidence → it's downgraded to *Unknown* (engine invariant, tested).
3. **AI advisor** — Google Gemini (`gemini-3.5-flash`) turns an **anonymised** summary into a calm, prioritised plan; deterministic rule-based fallback; you can see exactly what was sent.
4. **QoreChain account check** — is an ML-DSA-87 key registered? Is an EVM window open, and what's the most an attacker could move if ECDSA broke tomorrow?
5. **Quantum Pass** — a soulbound pass minted only for accounts protected by a registered ML-DSA-87 key, bound on-chain to that key.
6. **Public counter + share card** — passes, attested exposure buckets, chains; a 1200×675 card with no addresses.
7. **Ask about your plan** — follow-up Q&A ("why is my Taproot address red?", "what do I do with a Ledger?") on the same anonymised summary; questions containing addresses or seed phrases are refused before any model call; rule-based answers if the model is down.
8. **Watchlist** — save addresses on your device; every visit re-scans and flags a key revealed by a spend, new funds on an exposed key, a rising score, or funds moved to safety. Optional **email / Telegram alerts** (double opt-in, daily, deleted on unsubscribe).
9. **Scan API + embeddable widget** — `POST /api/v1/scan` for wallets, exchanges and custodians, and a two-line `<script>` widget that scans in the visitor's browser. Docs and live playground: [#/developers](https://shors-reach.vercel.app/#/developers).

## Quantum Pass requirements → proof

| Requirement | How | Proof |
|---|---|---|
| Use `create-qorechain-dapp` | `app/` = `viem-wagmi` template, `contracts/` = `foundry` template | First commit `bd58dbf` is the untouched scaffold |
| Connect QoreX | RainbowKit `qorexWallet` (EVM lane) + `window.qorex.native` (`enable`/`getKey`/`signAndBroadcast`) for the pass | `app/src/wagmi.ts`, `app/src/pass/qorex.ts` |
| Deploy on testnet | `QuantumPass` on qorechain-diana (EVM 9800) | [`0x4f54b69693458523223504b48fa7cd44657a56df`](https://explore.qore.network/address/0x4f54b69693458523223504b48fa7cd44657a56df), deploy tx `0x28f58054…7e2e` — [`deployments/diana.json`](deployments/diana.json) |
| Hybrid-signed transaction | Native txs carry `/qorechain.pqc.v1.PQCHybridSignature` (secp256k1 + ML-DSA-87) | EVM window `82CAAC03…1104` and `C584F991…3972`; pass proof `926E749D…E55F` (MsgSend + PQC extension, algorithm 1) |
| On-chain PQ verification | `mint()` verifies an ML-DSA-87 signature with the `pqcVerify` precompile `0x…0a01` against the key read from `pqcKeyStatus` `0x…0a02` | self-mint `0xb6ac662a…a38d` |

## How the Quantum Pass works

QoreX (0.3.x) signs **native** QoreChain transactions — always with the ML-DSA-87 layer — but not EVM transactions or arbitrary messages yet. So the pass has two doors:

- **QoreX path (`attest`)** — you send 1 uqor to yourself with a memo committing to your pass (salted scan hash + 3 coarse buckets). The chain only accepts it with a valid hybrid signature from your **registered** PQ key. `/api/attest` checks the committed tx (success, PQC extension, self-transfer, memo) and calls `attest()`; the contract re-reads the PQC registry, binds the pass to your key hash, and burns the proof so it can't be reused.
- **Direct path (`mint`)** — accounts that can send EVM txs sign the contract's digest with ML-DSA-87; the contract verifies it **fully on-chain** with `pqcVerify`. No attester.

Passes are soulbound (ERC-5192 `locked`, all transfer/approve paths revert), one per account, and store no addresses or amounts — only buckets.

```
 Browser (scan engine, no server)            QoreChain testnet (diana)
 ┌──────────────────────────────┐   REST    ┌───────────────────────────────┐
 │ BTC: mempool.space Esplora    │◀────────▶│ PQC registry · EVM windows    │
 │ EVM: 7 public RPCs            │          │ native lane: hybrid signatures│
 │ Prices: CoinGecko             │          │ EVM: QuantumPass ─▶ 0x0a01/0a02│
 └──────────┬───────────────────┘          └───────▲───────────────▲───────┘
            │ anonymised summary                    │ attest()      │ mint()
     /api/advise (Gemini)                   /api/attest      EVM-capable signer
            │                                       ▲
            ▼                     hybrid native proof (QoreX signAndBroadcast)
        /plan page  ──────────────────────────────▶ /pass stepper
```

Scan rules, statuses and limits in plain words: the in-app **Methodology** page (`app/src/pages/Methodology.tsx`) and [docs/architecture/02-scan-engine.md](docs/architecture/02-scan-engine.md).

## How it's made

- **App:** Vite + React + TypeScript, wagmi/viem, RainbowKit, `@qorechain/qorex-rainbowkit`, `@qorechain/qorex-types`, `@qorechain/sdk`, `@qorechain/evm`; `@noble/*` + `@scure/*` for Bitcoin key/script work; hash router (scan input stays in the URL fragment).
- **Contracts:** Solidity 0.8.28, Foundry; QoreChain precompiles `pqcVerify` (0x0a01) and `pqcKeyStatus` (0x0a02).
- **AI:** Google Gemini API (`gemini-3.5-flash`, REST, JSON-schema structured output, key rotation), zod-validated both ways — see [AI_USAGE.md](AI_USAGE.md).
- **Tests:** 105 app tests (scan engine on recorded mainnet fixtures incl. BIP-84 vectors, advisor, pass proof/relayer) + 18 Foundry tests (2 fuzz suites, attack cases). CI: typecheck, tests, build, forge.
- **Built with Claude Code** following a gated plan: [docs/prompts](docs/prompts) (P01→P13) and [PROGRESS.md](docs/prompts/PROGRESS.md).

## Run locally

```sh
cd app && npm install && npm run dev            # http://localhost:5173 — scan, plan, dashboard work with no keys
# optional, in app/.env (gitignored): GEMINI_API_KEYS=… (comma separated) for the AI plan; QORE_ATTESTER_MNEMONIC=… (testnet) for /api/attest
cd contracts && npm install && npm run forge-std && forge test
```

Tests: `cd app && npm test` · `cd contracts && forge test` · live scan CLI: `cd app && npm run scan:live -- <input>`.

User workflows (5 personas, real browser, live chains + AI): `cd app && npm run workflows -- https://shors-reach.vercel.app` → [docs/reports/workflows-production.md](docs/reports/workflows-production.md). Benchmark vs other quantum-exposure tools: [docs/BENCHMARK.md](docs/BENCHMARK.md) (`npm run benchmark`).

After editing `app/server/attest.ts`, run `npm run build:api` to regenerate the bundled `api/attest.js` (Vercel can't load @cosmjs's CJS→ESM require chain unbundled).
npm run build && npm run preview   # then, in another shell:
npm run e2e                         # E2E smoke via your installed Edge/Chrome

## Deployments (qorechain-diana)

| | |
|---|---|
| QuantumPass v2 | `0x4f54b69693458523223504b48fa7cd44657a56df` (attester = deployer, immutable) |
| QuantumPass v1 (superseded, self-mint only) | `0x6e48187e3717af4ccf6c9c27716c5d77d7af5c5d` |
| Live E2E, fresh account | proof `926E749DC6C1641ADDF6E87158E836C48084B0528707EC6D2B6849CCE56FE55F` → attest `0x872179a1355536531bd3f496b297e8d67d6b6ee86813131e38d5d42b739a2f60` |

## Privacy

The scan runs in your browser against public APIs; our servers never see what you scan. The AI advisor gets an anonymised summary (formats, verdicts, USD rounded to 2 significant figures) — identifiers are rejected server-side. We never ask for seeds or private keys. The watchlist lives in your browser's storage. Two features process an address on our server, both explicitly: the **Scan API** (in memory, never stored or logged) and **opt-in alerts** (stored with your email or Telegram chat id until you unsubscribe). Review: [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md).

## Limits (honest)

- **A diagnosis, not a rescue.** Shor's Reach never moves BTC or ETH; the Quantum Pass lives on QoreChain **testnet**.
- **Off-chain signatures are invisible** (permits, "Sign in with…") → shown as *Unknown*, refined by a questionnaire.
- **Raw-key (P2PK) exposure is only found from the key**, not from an address whose key never spent — paste the public key (that's how "Satoshi's genesis key" finds coins his address doesn't show).
- **Pass buckets are self-reported** and coarse; the **attest path trusts one attester** to have checked your native proof (the registry check and single-use proof are on-chain). It disappears once QoreX can sign EVM txs or messages — the fully on-chain `mint()` is already there.
- Native coins only (no tokens); HD scans use a gap limit of 20 (≤200 addresses); public RPCs can rate-limit — failures show as *Unknown*, never safe.
- Nobody knows when a cryptographically relevant quantum computer will exist. This shows exposure, not a date.

## Licence

MIT — see [LICENSE](LICENSE).
