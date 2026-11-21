# P07 — QuantumPass contract + precompile spike + testnet deploy  (target: 25–26 Nov)

## PROMPT
```
Read: architecture/03-contracts.md, docs/architecture/spikes.md (Q4), architecture/04-qorechain-integration.md.

Task P07:
1. Precompile spike: from build-before-qday workshop 2 / qorechain-core sources, confirm the exact call format of
   0x0A01 (ML-DSA-87 verify) and 0x0A02 (key status). Write a tiny probe contract + forge script that calls both on
   diana with the P02 account and a real ML-DSA signature (generated with @qorechain/pqc / SDK). Record results in spikes.md.
   Time-box: 3 hours. If 0x0A01 can't be made to work → use the documented fallback (status check on-chain + client verify).
2. contracts/src/QuantumPass.sol per spec: storage, mint checks, soulbound (ERC-5192 locked), counters, events, custom errors.
   Precompile addresses as constants; wrap calls in internal functions so tests can vm.etch mocks.
3. Tests (Foundry) — all rows of the spec table + fuzz; gas report for mint with real-size pk/sig calldata.
4. Deploy script (forge script) to diana: deployer = P02 account (PQ registered); open an EVM window first via the SDK
   script (allowed targets empty for CREATE, max_txs 3, 600 blocks). Save deployments/diana.json {address, txHash, block, deployer}.
5. Live: mint one pass from the deployer with a real scan hash + real ML-DSA signature (script), record tx hash.
6. Export ABI to app/src/qore/quantumPassAbi.ts.

Run the VALIDATION GATE.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | `forge test` all green, ≥ 10 tests incl. fuzz | output |
| 2 | Gas for mint recorded | `forge test --gas-report` |
| 3 | Contract deployed; address + tx hash in deployments/diana.json | explorer / eth_getCode ≠ 0x |
| 4 | Live mint tx succeeded; `passOf(deployer).mintedAt > 0` | cast call output |
| 5 | Spike result documented (0x0A01 used or fallback chosen + why) | spikes.md |
| 6 | Source + compiler settings committed (explorer has no verification) | foundry.toml |

## IF THE GATE FAILS
```
P07 gate failed on: <items>. EVM rejections: run classifyEvmWindowRejection on the error; check window (max_txs used up?),
PQ registration, coin-60 key. Fix and re-run.
```

## Hand-off
Tag `p07-done`. Requirement "deploy on testnet" is now met.
