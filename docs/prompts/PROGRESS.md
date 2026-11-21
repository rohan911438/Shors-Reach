# Build progress

Mark each prompt ✅ only after its validation gate fully passes. Record evidence links/hashes.

| Prompt | Status | Date done | Evidence / notes |
|---|---|---|---|
| P01 Setup, accounts, scaffold | ✅ | 21 Nov | Scaffold = first commit (create-qorechain-dapp 0.14.0 viem-wagmi + foundry); MIT; CI; `forge test` 3/3; tsc clean. 👤 pending: install QoreChain Build GitHub App, fest registration check |
| P02 QoreChain spike + first hybrid tx | ✅ | 21 Nov | Hybrid tx `82CAAC0311B6927598BBD789BFD250CE236DD6DD0B241CB444B511CFE74A1104` (MsgOpenEVMWindow + PQCHybridSignature). QoreX-in-app path moved to P10. See `docs/architecture/spikes.md` |
| P03 Scan core + BTC classification | ✅ | 21 Nov | types, net (retry/timeout/cache/concurrency), decodeAddress (18 cases), Esplora client |
| P04 BTC key-level scan | ✅ | 21 Nov | pubkey extraction, 7 sibling forms incl. BIP-86, P2PK scripthash, xpub (BIP-84 vectors pass). Live: genesis key → 4 holdings ≈ $6.46M EXPOSED_NOW, evidence = genesis coinbase |
| P05 EVM + QoreChain scanners | ✅ | 21 Nov | 7 EVM chains, cross-chain rule, EIP-7702, Safe owners, QoreChain PQ key + window; live vitalik.eth + our account verified |
| P06 Pricing, scoring, orchestrator | ✅ | 21 Nov | CoinGecko, evidence invariant, score, anonymiser + leak test, `npm run scan:live`. **64/64 tests** on recorded fixtures |
| P07 QuantumPass contract + deploy | ⬜ | | |
| P08 Scan UI + methodology | ⬜ | | |
| P09 AI advisor | ⬜ | | |
| P10 Quantum Pass flow e2e | ⬜ | | |
| P11 Dashboard, share, E2E, deploy | ⬜ | | |
| P12 Security review + docs | ⬜ | | |
| P13 Video, cover, submission | ⬜ | | |

Legend: ⬜ not started · 🟨 in progress · 🟥 gate failed · ✅ done
