# P03 — Scan engine core + Bitcoin classification  (target: 23 Nov)

## Goal
The framework-free scan library skeleton, shared types, a rate-limited fetch layer, Bitcoin address classification and the
first two BTC verdicts (Taproot = EXPOSED_NOW; never-spent hash address = EXPOSED_ON_SPEND).

## PROMPT
```
Read: architecture/02-scan-engine.md (all), architecture/01-overview.md (status vocabulary).

Task P03 — scan core:
1. app/src/scan/types.ts: Status, ReasonCode (enum with all reasons from the spec), Holding, ScanResult, SourceHealth.
   No React imports anywhere under src/scan (add an ESLint rule or a test that greps for it).
2. app/src/scan/net.ts: fetch wrapper with per-host concurrency limit (4), timeout (10 s), 2 retries with backoff,
   in-memory cache per session, and a pluggable transport so tests use recorded fixtures (no network in unit tests).
3. app/src/scan/btc/classify.ts: detect p2pkh / p2sh / p2wpkh / p2wsh / p2tr / invalid from an address
   (use @scure/base bech32/bech32m + base58check; validate checksums; mainnet only; reject testnet addresses with a clear error).
   Also detect xpub/ypub/zpub strings (classification only; derivation is P04).
4. app/src/scan/btc/esplora.ts: typed client for /address/{a}, /address/{a}/txs (+ paging), /address/{a}/utxo, /scripthash/{h}.
   Configurable base URL (default https://mempool.space/api).
5. app/src/scan/btc/scan.ts (first version): Taproot → EXPOSED_NOW (reason taproot-output-key, evidence = first funding tx);
   never-spent hash types → EXPOSED_ON_SPEND (reason hash-hidden). Spent-from addresses return a placeholder "needs-key-scan" (P04).
6. Record real API responses into app/src/scan/__fixtures__/ with a script (scripts/record-fixtures.ts) for:
   1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa, one bc1p address with balance, one never-spent bc1q address with balance.
7. Tests (Vitest): classification table (≥20 cases incl. bad checksums, testnet, xpub), esplora client parsing, Taproot rule,
   hash-hidden rule, net.ts retry/timeout behaviour.

Run the VALIDATION GATE and report.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | All tests pass, no network in unit tests | `npx vitest run src/scan` (run with network disabled env flag) |
| 2 | ≥20 classification cases | test file count |
| 3 | No React in scan engine | grep / lint rule passes |
| 4 | Taproot fixture → EXPOSED_NOW with evidence txid | test |
| 5 | Never-spent bc1q fixture → EXPOSED_ON_SPEND | test |
| 6 | `npx tsc --noEmit` clean | exit 0 |
| 7 | Live smoke: `npm run scan:live -- bc1p…` prints a verdict | output pasted |

## IF THE GATE FAILS
```
P03 gate failed on: <items>. Fix with minimal changes; do not add P04 features. Re-run gate.
```

## Hand-off to P04
Tag `p03-done`.
