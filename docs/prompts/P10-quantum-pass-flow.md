# P10 — Quantum Pass flow end-to-end on testnet  (target: 28 Nov)

## PROMPT
```
Read: architecture/04-qorechain-integration.md (sequence), docs/architecture/spikes.md, architecture/03-contracts.md,
deployments/diana.json.

Task P10:
1. "/pass" PassStepper implementing steps 1–8 of the sequence with QoreX:
   connect → status (account + window; show "max loss if ECDSA breaks") → register PQ key if needed (warn: one-time,
   never retried automatically) → open scoped window (HYBRID tx: 600 blocks, max_txs 2, max_value 0, allowed_targets [QuantumPass])
   → sign scan hash with ML-DSA (per spike) → mint → done (tx hashes + explorer links).
2. Scan hash = keccak256(canonical JSON of anonymised summary + random 32-byte salt kept client-side).
   Buckets computed from the scan result; if user arrives without a scan, require a quick scan first.
3. Errors mapped via classifyEvmWindowRejection; low balance → faucet link.
4. QoreStatusCard on /scan for 0x/qor1 inputs reuses the same status code.
5. E2E (Playwright + @qorechain/qorex-wallet-mock): stepper reaches done with mocked RPC.
6. 👤 Real run with QoreX on testnet from a FRESH account (faucet-funded) — record window tx hash and mint tx hash.

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | 👤 Fresh account completes the full flow in < 3 min | screen recording (reuse in video) |
| 2 | Window tx is hybrid-signed (PQC extension present) | REST tx query output |
| 3 | `passOf(user)` populated; counters incremented | cast/viem read |
| 4 | Re-mint attempt shows friendly "already minted" | 👤 |
| 5 | E2E passes | output |
| 6 | Hashes recorded in PROGRESS.md + README draft | file |

## IF THE GATE FAILS
```
P10 gate failed on: <items>. If the ML-DSA signing step blocks, switch to the documented fallback and update docs. Re-run.
```

## Hand-off
Tag `p10-done`. All four track requirements now met through the product itself.
