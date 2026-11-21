# P02 — QoreChain spike + first hybrid-signed tx  (target: 22 Nov)

## Goal
Answer the unknown integration questions with facts, and complete the track's **hybrid-signed transaction** early
(de-risks the whole submission).

## PROMPT
```
Read: architecture/04-qorechain-integration.md (spike questions), research/01-hackathon-and-qorechain.md §6–9.

Task P02 — spike + first hybrid tx:
1. Research (read code, don't guess):
   - github.com/qorechain/build-before-qday (workshops 1 and 2)
   - github.com/qorechain/qorechain-sdk (packages for qorex-*, qoresign, sdk: openEvmWindowMsg, fetchEvmWindow, ensurePqcRegistered)
   - the installed node_modules/@qorechain/* type definitions in app/
   Answer the 4 spike questions:
   Q1 how a dApp asks QoreX to sign a native hybrid tx; Q2 whether QoreX can sign MsgOpenEVMWindow;
   Q3 how to get an ML-DSA signature over arbitrary bytes from QoreX; Q4 ABI/encoding of precompiles 0x0A01 / 0x0A02.
   Write answers + code snippets + source links to docs/architecture/spikes.md. Mark each "CONFIRMED (tested)" or "FROM SOURCE (untested)".
2. Script path (de-risk): app/scripts/hybrid-send.ts using @qorechain/sdk with a TESTNET-ONLY mnemonic from .env
   (generate a new one; human funds it from the faucet): register PQ key if needed (ensurePqcRegistered), then
   bankSend 1 uqor to self with memo "shors-reach p02". Print tx hash + explorer URL.
3. Wallet path: in the app, add a temporary /dev page: connect QoreX → read /pqc/v1/account and /pqc/v1/evm_window for
   the connected address → button that triggers a hybrid-signed native tx via QoreX (open a tiny EVM window if Q2 = yes,
   else 1-uqor self-send). Show tx hash.
4. Add app/src/qore/config.ts (network constants) and app/src/qore/rest.ts (typed fetchers for params, account, evm_window).
5. Small commits.

Run the VALIDATION GATE and report.
```

## VALIDATION GATE
| # | Check | How |
|---|---|---|
| 1 | spikes.md answers Q1–Q4 with sources | file review |
| 2 | Script hybrid tx succeeded | tx hash; `GET https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/{hash}` shows code 0 and a PQC hybrid extension |
| 3 | 👤 QoreX hybrid tx from the app succeeded | tx hash visible in QoreX + explorer |
| 4 | REST fetchers typed + unit-tested with recorded fixtures | `npx vitest run src/qore` |
| 5 | No mnemonic in git | `git log -p | grep -i mnemonic` → only `.env.example` placeholder |
| 6 | Hashes recorded in PROGRESS.md | file review |

## IF THE GATE FAILS
```
P02 gate failed on: <items>. If QoreX can't sign the needed message, implement the documented fallback
(hybrid self-send with memo) and update architecture/04-qorechain-integration.md accordingly. Re-run the gate.
If a hybrid tx fails, decode the error (codespace pqc codes 26/27/28, signBytesVersion, missing rest) and fix.
```

## Hand-off to P03
Tag `p02-done`. The track's hybrid-tx requirement is now met. Update architecture docs with spike facts.
