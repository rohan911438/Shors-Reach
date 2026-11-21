# Shor's Reach — planning workspace

> **See your crypto the way a quantum attacker sees it — then lock your QoreChain account before they can.**
> Entry for the **QoreChain Developer Fest "Build Before Q-Day"** · Main track: **Quantum Pass** · Deadline **2 Dec 2026, 23:59 UTC**

This folder is the **plan**, not the code. It holds the research, the idea, the track strategy, the architecture and the
sequential build prompts. The code will live in a sibling repo (`../shors-reach`), and this folder will be copied into its `docs/`.

## The idea in 30 seconds
- ~30% of all Bitcoin (~6–7M BTC) and most active Ethereum wallets sit behind **public keys a quantum computer could break**.
  Holders can't see whether they are exposed, and their chains have no post-quantum fix today.
- Our app runs a **key-level exposure scan** across Bitcoin and 8 EVM chains, catching cases naive scanners miss
  (Satoshi-style P2PK coins, Taproot, sibling address formats, cross-chain key reuse, HD wallets). **Every verdict links to
  the transaction that proves it.**
- An **AI advisor** turns the result into a calm, prioritised plan.
- It then checks the user's **QoreChain** account (an *unregistered* account is as weak as Ethereum!) and mints a
  soulbound **Quantum Pass**: register the ML-DSA-87 key → open a tightly scoped EVM window with a **hybrid-signed tx** →
  sign the scan hash with the PQ key → mint on testnet.
- A public counter shows how much exposed value has moved under PQ protection.

## Folder map
| Folder | What's inside | Start with |
|---|---|---|
| [`research/`](research/) | Hackathon rules & QoreChain tech, competition analysis (25 Quantum Pass entries), quantum-threat research with sources | `01-hackathon-and-qorechain.md` |
| [`idea/`](idea/) | Problem, solution, why this idea (scored against alternatives), user flows | `01-problem.md` |
| [`tracks/`](tracks/) | Main track fit (requirement → proof), side awards we apply to, submission checklist | `01-quantum-pass-main-track.md` |
| [`architecture/`](architecture/) | System overview, **scan engine spec (the core)**, contract, QoreChain integration, frontend, AI advisor, security/privacy, repo & tooling | `01-overview.md`, `02-scan-engine.md` |
| [`prompts/`](prompts/) | 13 sequential build prompts (P01→P13), each with a validation gate; progress tracker; backlog | `00-how-to-use.md` |

## Tracks applied
| Track / award | Status |
|---|---|
| **Quantum Pass** (main) — 10×$150 + 20×$50 raffle | Target: top 10 |
| Best AI-Native Build — $500 | Applying (AI advisor + `AI_USAGE.md` + prompts/) |
| People's Choice — $500/$300/$200 | Applying (share card, X posts 6–15 Dec) |
| Regional / Top-Quality | Automatic fallback if no other prize |
| Quantum Campus | Only if every member is a student |
| Q-Day Survivor | Closed (drill ran 18 Nov) |

## How the build proceeds
```
P01 setup & scaffold ─► P02 QoreChain spike + first hybrid tx ─► P03 scan core ─► P04 BTC key-level ─► P05 EVM + QoreChain
   ─► P06 scoring & orchestrator ─► P07 contract + deploy ─► P08 scan UI ─► P09 AI advisor ─► P10 Pass flow (testnet)
   ─► P11 dashboard, share, deploy ─► P12 security review + docs ─► P13 video, cover, submission
```
Each prompt ends with a **validation gate**; the next prompt starts only when every check passes.
Track progress in [`prompts/PROGRESS.md`](prompts/PROGRESS.md).

## Quantum Pass requirements → where they are met
| Requirement | Met in |
|---|---|
| Use `create-qorechain-dapp` | P01 (`viem-wagmi` app + `foundry` contracts) |
| Connect QoreX | P02 (spike), P10 (Pass flow) |
| Deploy on testnet | P07 (`QuantumPass.sol` on qorechain-diana) |
| One hybrid-signed tx | P02 (first), P10 (window-open tx per user) |

## Key links
Fest https://build.qorechain.io · Docs https://docs.qorechain.io · Faucet https://dashboard.qorechain.io/faucet ·
Explorer https://explore.qore.network · Examples https://github.com/qorechain/build-before-qday · Discord https://discord.gg/qorechain

## Open decisions (to discuss before P01)
1. Team: solo or 2 people? Students (Quantum Campus)?
2. Final product name (Shor's Reach / Q-Day Exposure / KeyLight / Exposed).
3. GitHub repo name and owner account.
4. Anthropic API key for the advisor (Vercel env var).
