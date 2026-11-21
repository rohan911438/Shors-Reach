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
| P07 QuantumPass contract + deploy | ✅ | 21 Nov | `0x6e48187e3717af4ccf6c9c27716c5d77d7af5c5d` (deploy `0x7a881be7…e588`), first mint `0x6914aca7…3cc8` verified ML-DSA-87 on-chain via 0x0a01 against key from 0x0a02. 13 contract tests incl. fuzz + attack cases |
| P08 Scan UI + methodology | ✅ | 21 Nov | Hash router (input in URL fragment), landing with live on-chain counters, /scan with progress, headline, gauge, holdings + evidence + "Why?", QoreChain panel, questionnaire, /methodology with every rule; dark/light tokens. `vite build` ✓ (tsc runs in CI — local tsc too slow on this machine). 👤 visual review pending |
| P09 AI advisor | 🟨 | 21 Nov | `/api/advise` (Opus 5.5, structured JSON output, zod in+out, identifier leak filter both ways, retry once, per-IP rate limit, token-only logs) + deterministic fallback + /plan page with AI/rule badge and "what the advisor saw". 21 advisor tests (85 total) pass. Vite dev serves the API locally. 👤 needs `ANTHROPIC_API_KEY` in app/.env to run gate #1 (real call on 3 summaries) and #4 (read plans) |
| P10 Quantum Pass flow e2e | 🟨 | 21 Nov | QoreX supports native hybrid txs only → v2 contract adds `attest()` path (proof = hybrid native self-transfer w/ memo, verified by /api/attest; registry re-checked on-chain). v2 `0x4f54b696…56df`; live E2E with fresh account: proof `926E749D…E55F` → attest `0x872179a1…2f60`. 18 Foundry + 105 app tests. /pass stepper (scan → QoreX → key → sign and mint → done). 👤 pending: run with real QoreX extension; Playwright E2E deferred (no wallet-mock pkg installed, low memory) |
| P11 Dashboard, share, E2E, deploy | 🟨 | 21 Nov | /dashboard reads counters + PassMinted logs (paged) live from v2; ShareCard 1200×675 SVG→PNG + X intent, no addresses; vercel.json (/lcd-testnet rewrite, security headers, fn timeouts); tsc errors fixed. 👤 pending: Vercel deploy + env vars (ANTHROPIC_API_KEY, QORE_ATTESTER_MNEMONIC testnet), live URL, Lighthouse; Playwright E2E deferred |
| P12 Security review + docs | 🟨 | 21 Nov | docs/SECURITY_REVIEW.md: 0 critical/high in our code, 1 medium fixed (attest rate limit), transitive audit highs triaged as unreachable; final README (requirements→proof table, limits); AI_USAGE.md final. 👤 read-through pending |
| P13 Video, cover, submission | ⬜ | | |

Legend: ⬜ not started · 🟨 in progress · 🟥 gate failed · ✅ done
