# 01 — Main track: Quantum Pass

## Track facts
- Team 1–2 · Prizes: **10 × $150** (jury) + **20 × $50** raffle (passing QP projects that didn't win $150; drand, public script).
- Brief: "Build a small original QoreChain app, tool, game or bot." Examples: mini-game, PQC checker, signed certificate, Telegram bot.
- **Main requirements:** "Use create-qorechain-dapp, connect QoreX, deploy on testnet and complete one hybrid-signed transaction."

## Requirement → how we meet it → how it is proven
| Requirement | How we meet it | Proof for jurors (checked manually / auto) |
|---|---|---|
| Use `create-qorechain-dapp` | App scaffolded with `npx create-qorechain-dapp@0.14.0 shors-reach --template viem-wagmi` (contracts via `--template foundry` into `/contracts`) | First commit = untouched scaffold; README "How it's made" names the command + template; `@qorechain/*` deps in `package.json` |
| Connect QoreX | QoreX connector via `@qorechain/qorex-rainbowkit` (EVM) and the QoreX native signer for hybrid txs | Video shows connect; dependency auto-detected → "Verified" |
| Deploy on testnet | `QuantumPass.sol` deployed on qorechain-diana (EVM 9800) | Contract address in README + project page; deploy tx hash |
| One hybrid-signed tx | `MsgOpenEVMWindow` (native, hybrid secp256k1 + ML-DSA-87) opened per user before mint; plus our own hybrid test send in prompt 02 | Tx hashes in README; explorer shows PQC hybrid extension |

> Note: the first PQ **key registration** is classical-only by protocol, so it does **not** count as the hybrid tx.
> The window-open tx (and any native send) does.

## Why this project fits Quantum Pass better than any other track
| Track | Fit | Reason |
|---|---|---|
| **Quantum Pass** | ✅ **Best** | "Small original app/tool"; "PQC checker" is a named example; the *Pass* is literally what we mint; 1–2 person scope |
| Post-Quantum dApp | ⚠️ | Would also need two-stage QCAI audit + pqcVerify + full test suite; heavier competition ($1.5k prizes, top teams) |
| PQ AI Agents | ❌ | Needs agent spending rules & smart-account limits — not our product |
| Encrypted Apps | ❌ | ML-KEM is not core to us |
| Cross-VM / Protocol Builders | ❌ | Different problem; Protocol Builders needs 2–4 people |

## How the jury likely scores (inferred from category text + winning patterns)
| Likely criterion | Our evidence |
|---|---|
| Requirements met & verifiable | All four, with tx hashes, Verified kits |
| Originality | Only cross-chain key-level exposure scanner in the fest |
| Usefulness / real problem | ~30% of BTC exposed; users can't see it |
| Uses QoreChain meaningfully | PQ key registration, scoped EVM window, ML-DSA signature, precompiles |
| Quality | Tests with counts, CI, live demo, honest limits |
| Presentation | 3-min video following the juror path (see `../idea/04-user-flows.md` Flow E) |

## Target
Top 10 ($150). Floor: pass all checks → automatic $50 raffle entry.
