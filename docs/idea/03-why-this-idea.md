# 03 — Why this idea (and not the others)

## How we chose
We asked: **what does QoreChain need most, and which of those needs is still open in the Quantum Pass track?**

| QoreChain need | Evidence | Already covered in the fest? |
|---|---|---|
| A personal reason for people to move | The Q-Day story is abstract | ❌ open |
| New users from other chains | Young L1, ~381 builders, near-zero QP votes | ❌ open |
| Onboarding / key + window debugging | Docs gotchas, error codes 26/27/28 | ⚠️ pq-check, PQ Health, Unyoke |
| Explorer source verification | Explorer has none | ⚠️ Hallmark |
| Account monitoring | — | ⚠️ QoreWatch |
| Proof of "verify, not believe" | Marketing line; 0x0A01 rarely used | partial |

**Conclusion:** dev-tooling gaps are taken by strong teams. The open gap — and the one that matters most to a young L1 — is
**demand**: turning the Q-Day threat into a personal, verifiable reason to use QoreChain.

## Ideas we scored
| Idea | Qore need | Unique in QP | Jury appeal | Votes potential | Feasible in 11 days |
|---|---|---|---|---|---|
| Event tickets signed with ML-DSA | Low | ✅ | Medium | Low | ✅ |
| Gating bot (Telegram/Discord) | Low | ✅ | Medium | Low | ✅ |
| Signed-move duel game | Low | ✅ | Low (games add little real value) | Medium | ✅ |
| ProofCam (PQ-signed photos) | Medium | ⚠️ notary-like | Medium | Medium | ✅ |
| MetaMask → PQ onboarding wizard | High | ❌ 3 similar | Medium | Low | ✅ |
| PQ payment links | Medium | ✅ | Medium | Low | ✅ |
| Real BTC/ETH migration (bridge) | High | ✅ | High | Medium | ❌ bridge testnet-only, too big |
| **Key-level exposure scan → Quantum Pass** | **High** | **✅** | **High** | **High** | **✅** |

## Why it is believable, not marketing
- Every verdict is backed by a public transaction the user can open.
- Rules come from protocol facts (BIP-341 Taproot output keys, ECDSA public-key recovery, QoreChain chain params), and we
  tested the data sources live (see `../research/01-hackathon-and-qorechain.md` §9 and `../architecture/02-scan-engine.md`).
- We publish a methodology page and an honest Limits section.

## Why it fits QoreChain's vision exactly
"Build Before Q-Day" = act before the threat lands. The app shows the threat *for you*, proves it, and makes the first PQ
step on QoreChain in under two minutes. It also tells a truth about QoreChain itself (register early) — showing the team we
understand their protocol beyond the marketing.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Seen as "another checker" | Lead with cross-chain + evidence + $ value; QoreChain is the answer, not the subject |
| ML-DSA verify precompile interface unclear | Spike in prompt 07; fallback = key-status precompile `0x0A02` + hybrid tx |
| QoreX native signing from a dApp undocumented | Spike in prompt 02 using `viem-wagmi` template + `@qorechain/qorex-*` kits |
| Fearmongering | Calm tone, separate long- vs short-exposure, cite skeptic views, never sell |
| Scope creep | Strict prompt sequence with validation gates; stretch items marked |
