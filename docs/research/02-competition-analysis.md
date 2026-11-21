# Competition analysis — Quantum Pass entries (as of 2026-11-21)

25 of 115 fest projects are in Quantum Pass. Almost none have community votes yet.

## All Quantum Pass entries
| Project | Type | Idea | Strength (page-based) |
|---|---|---|---|
| Unyoke | tool | Lists & revokes approvals/grants on EVM + native lanes | Strong: 99 unit tests, 18/18 testnet e2e, live demo |
| Q-Day Readiness Audit | tool + CLI + registry | Grades a qor1/0x account A–F, attests via hybrid self-tx | Strong: CI, e2e with QoreX mock |
| Mempool Guard | arcade game | Approve/reject txs under timer; ML-DSA-signed runs, replay-verified | Strong design |
| QoreWatch | Telegram bot | Alerts on money moves, key rotation, window events | Very polished: 22 commands, 148+ tests |
| Hallmark | verification tool | Recompile contract, match on-chain bytecode | Ambitious |
| Quantum Flip | game | Coin flip behind PQ window | Strong & candid (BLOCKHASH=0 disclosed) |
| Q-Day Rescue Run | edu game | 5 PQ missions, survivor badge via 0x0A02 | Good |
| Qwakk Island + Duck Pass | 3D game | Duck shooter + wallet-link self-tx | Heavy build, thin PQ part |
| QDay Proof | tool | Hybrid signature proof | Small but clean |
| Quantum Tip Jar | dApp | Tips via hybrid tx | Good UI, no tests |
| Quantum Dice | game | Dice via hybrid tx | Simple |
| Quantum Pass Counter | demo | Counter + PqcGate | Partly unwired |
| qorechain-pq-check | CLI | Would my next EVM tx be admitted? | Strong engineering |
| Qore PQ Health | tool | 0–100 readiness score + repair | Moderate; only QP entry with a vote |
| PQC Certificate | certificate | Doc hash + issuer on-chain | Solid |
| Quantum-Safe Certificate | certificate | Mint "Quantum Safe" cert | Thin |
| QorePQC | tool | Text/file sign & verify | Thin |
| QoreStamp (×2) | notary / AI attestation | Hash stamping | Good |
| Xore Names | name service | .qore names | Functional |
| Q-Will / QWill | wills | Sealed messages, dead-man switch | Working / early |
| Harvest-Proof Time Capsule | time-lock | Sealed letter hash | Thin |
| QPredict | game | Commit-reveal even/odd | Careful design |
| Vhenix | placeholder | — | Empty |

## Saturation map
| Theme | Count | Verdict |
|---|---|---|
| QoreChain-account readiness / health checkers | ~5 | Saturated — but **all only look at QoreChain accounts** |
| Certificates / notary / stamps | ~6 | Saturated |
| Wills / time capsules | ~4 | Saturated |
| Chance games | ~6 | Saturated (and "games in web3" add little real value) |
| Cross-chain (BTC/ETH) quantum exposure | **0** | **Open** |
| Migration funnel from other chains → QoreChain | **0** | **Open** |

## What winning entries do well
1. Honest "Limits" section.
2. Tests / CI with numbers quoted.
3. Tx hashes and contract addresses cited on the page.
4. Kits **Verified** (in dependency files + on-chain), not only "Declared".
5. Live demo + video.

## Where we differ from the closest entries
| Entry | They do | We do |
|---|---|---|
| Q-Day Readiness Audit / Qore PQ Health / pq-check | Score a **QoreChain** account's readiness | Scan **Bitcoin + all EVM chains** at **key level**, value at risk in $, with evidence txs; QoreChain is the *answer*, not the subject |
| QoreWatch | Monitor QoreChain accounts | One-shot diagnosis + migration |
| Certificates | Prove a document | The Pass proves a **real migration action** (PQ key registered + signed scan result) |
