# 05 — Frontend

Scaffold: `create-qorechain-dapp --template viem-wagmi` (Vite + React + TS + wagmi + RainbowKit + QoreX). Add Tailwind, React Router.

## Routes
| Route | Page | Notes |
|---|---|---|
| `/` | Landing + scan input | Live counter from contract; example chips ("Try Satoshi's address", "Try vitalik.eth") |
| `/scan/:input?` | Results | Input kept in URL **fragment** (`#`) so it never reaches any server log |
| `/plan` | AI plan | Uses result from memory; questionnaire |
| `/pass` | Quantum Pass flow | Stepper: connect → status → register → window → sign → mint → done |
| `/dashboard` | Public stats | Reads contract events/counters |
| `/methodology` | Rules & sources | One section per ReasonCode; limits |

## Key components
- `ScanInput` — autodetect type, validate, examples.
- `ScanProgress` — per-source live status (BTC formats, EVM chains, QoreChain, prices).
- `ExposureHeadline` — "$X exposed now" + split bars (NOW / ON_SPEND / UNKNOWN / PROTECTED).
- `HoldingsTable` — chain, format, amount, USD, status pill, reason, evidence link; "Why?" drawer.
- `QoreStatusCard` — PQ key registered? possession proven? window scope → "max loss if ECDSA breaks".
- `PassStepper` — the 7-step sequence from `04-qorechain-integration.md`, each step shows its tx hash.
- `ShareCard` — canvas/SVG image 1200×675 with score + "#BuildBeforeQDay" (no addresses on it).
- `SourceHealth` — shows which sources failed (never silently "safe").

## State
- Scan result in a React context (memory only). No localStorage for addresses; only UI prefs.
- wagmi for wallet state; react-query for fetch caching.

## UX rules
- Calm tone; separate long- vs short-exposure; never "you will lose your money".
- Every red number has a "Why?" and an evidence link.
- Works at 375 px width.
- Light/dark theme.
- Loading skeletons; each source can fail independently.

## E2E (Playwright + `@qorechain/qorex-wallet-mock`)
1. Scan fixture address (API mocked) → headline + rows correct.
2. Pass flow with mock wallet → stepper reaches "done".
3. Mobile viewport snapshot.
