# P05 — EVM multi-chain + QoreChain scanners  (target: 24 Nov)

## PROMPT
```
Read: architecture/02-scan-engine.md §2–3, docs/architecture/spikes.md, app/src/qore/rest.ts (from P02).

Task P05:
1. evm/chains.ts: Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche (publicnode RPC URLs, native symbol,
   CoinGecko id, explorer URL template) + QoreChain EVM testnet (9800).
2. evm/scan.ts: for an address, in parallel per chain: eth_getTransactionCount, eth_getBalance, eth_getCode.
   - nonce>0 on ANY chain → all balances EXPOSED_NOW (reason evm-nonce-on-<chain>, evidence = chain explorer address page + nonce).
   - all nonce 0 → EXPOSED_ON_SPEND unless questionnaire says signed messages = yes/unsure → UNKNOWN (reason offchain-signature-possible).
   - code starts 0xef0100 → EIP-7702 → treat as EOA.
   - other code → try Safe getOwners() (eth_call 0xa0e67e2b); scan each owner (recursion depth 1); wallet status = worst owner; else UNKNOWN (contract-wallet-unknown).
   - chain RPC failure → SourceHealth down, holdings on that chain UNKNOWN (source-unavailable).
3. qore/scan.ts: accept 0x or qor1 (bech32 HRP "qor", same 20 bytes; test 0xd8dA…6045 ⇄ qor1mrdxhunfvjhe6lhdncp72dq46da2jcz9ew85sn).
   - /pqc/v1/account found=false → EXPOSED_NOW (pq-key-not-registered) for its uqor balance (/cosmos/bank/v1beta1/balances).
   - found=true → native PROTECTED; read /pqc/v1/evm_window → if live, compute maxLossIfEcdsaBreaks = min(balance, remaining_value)
     (+ note allowed_targets / native_only); expose as structured field.
   - read /pqc/v1/params once; if hybrid_signature_mode != required → downgrade to UNKNOWN (never assume).
4. Fixtures + tests: vitalik.eth multi-chain (recorded), nonce-0 address, a Safe, RPC failure, qor1 unregistered,
   qor1 registered + live window (use the P02 account; record fixture).

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | Tests pass offline | `npx vitest run src/scan` |
| 2 | Cross-chain rule: nonce on Base only → Ethereum balance EXPOSED_NOW | test |
| 3 | RPC failure never yields EXPOSED_ON_SPEND/PROTECTED | test |
| 4 | bech32 round-trip test | test |
| 5 | Live: P02 qor1 shows PROTECTED native + window info | output |
| 6 | Live: fresh testnet address (unregistered) → pq-key-not-registered | output |

## IF THE GATE FAILS
```
P05 gate failed on: <items>. Fix, add regression fixture, re-run. Safe support may be cut (cut list #2).
```

## Hand-off
Tag `p05-done`.
