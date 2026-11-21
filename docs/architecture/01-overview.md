# 01 — Architecture overview

## System diagram
```
                        ┌──────────────────────────── Browser (React + Vite) ───────────────────────────┐
 User input ──────────► │  Input detector ─► SCAN ENGINE (pure TS, no React)                             │
 (BTC addr / xpub /     │                     ├─ btc/   key-level Bitcoin scan ──────────────► mempool.space (Esplora REST)
  0x / qor1)            │                     ├─ evm/   multi-chain nonce+balance ────────────► publicnode RPCs (8 chains)
                        │                     ├─ qore/  PQ key + EVM window status ───────────► api-testnet.qore.host (REST)
                        │                     ├─ price/ USD valuation ────────────────────────► CoinGecko
                        │                     └─ score/ verdicts + evidence + score              │
                        │                                                                         │
                        │  Results UI ─► "Get plan" ── anonymised summary ──► /api/advise ──────────┼──► Vercel function ─► Claude API
                        │                                                                         │
                        │  Quantum Pass flow:                                                     │
                        │   QoreX connect ─► register PQ key (classical, once)                     │
                        │                ─► open scoped EVM window  (HYBRID-SIGNED native tx) ─────┼──► rpc-testnet.qore.host
                        │                ─► ML-DSA sign scan hash ─► mint() on QuantumPass ────────┼──► evm-testnet.qore.host (9800)
                        │                                                                         │
                        │  Dashboard ◄─────────────── reads QuantumPass events/state ──────────────┼─── evm-testnet.qore.host
                        └─────────────────────────────────────────────────────────────────────────┘
```

## Components
| Component | Tech | Responsibility | Spec |
|---|---|---|---|
| Scan engine | TypeScript, `@noble/*`, `@scure/*`, `bitcoinjs-lib` | All exposure logic; framework-free; fully unit-tested | `02-scan-engine.md` |
| QuantumPass contract | Solidity 0.8.24, Foundry (from create-qorechain-dapp `foundry` template) | Soulbound pass, PQ checks via precompiles, public counters | `03-contracts.md` |
| QoreChain integration | `@qorechain/sdk`, `@qorechain/qorex-*`, viem/wagmi | Wallet connect, PQ registration, hybrid window tx, mint | `04-qorechain-integration.md` |
| Frontend | React + Vite + TS (create-qorechain-dapp `viem-wagmi` template), Tailwind | Scan UI, results, plan, pass flow, dashboard, share card | `05-frontend.md` |
| AI advisor | Vercel Node function + Anthropic SDK | Anonymised summary → prioritised plan | `06-ai-advisor.md` |
| Security & privacy | — | Threat model, data handling | `07-security-privacy.md` |
| Repo / tooling / CI / deploy | npm, Vitest, Foundry, GitHub Actions, Vercel | Structure and quality gates | `08-repo-and-tooling.md` |

## Key design decisions
1. **Scan runs client-side.** Our server never sees addresses/xpubs → privacy + no backend database.
2. **Scan engine is a pure library.** No React imports → testable with fixtures, reusable as CLI (stretch).
3. **Only one server function** (AI advisor) — keeps the Claude API key secret; receives no addresses.
4. **Chain is the database** for passes and the public counter → anyone can verify the dashboard.
5. **Testnet only** for QoreChain writes (fest rule). BTC/EVM reads are mainnet data (read-only).
6. **Graceful degradation:** each data source can fail independently → result shows "UNKNOWN (source unavailable)", never a false "safe".

## Status vocabulary (used everywhere)
| Status | Meaning |
|---|---|
| `EXPOSED_NOW` | Public key is on-chain; coins attackable at rest (long-exposure) |
| `EXPOSED_ON_SPEND` | Key hidden by a hash; revealed only when spending (short-exposure) |
| `PROTECTED` | PQ signature required (QoreChain native) or window-bounded |
| `UNKNOWN` | Cannot be determined (off-chain signatures, source failure, P2PK index gap) |
