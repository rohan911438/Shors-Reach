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
| P09 AI advisor | ✅ | 22 Nov | `/api/advise` now on **Google Gemini `gemini-3.5-flash`** (REST, `responseJsonSchema`, thinking low, key rotation over `GEMINI_API_KEYS`), zod in+out, identifier leak filter, negation-aware secret-request guard, retry once, per-IP rate limit, token-only logs + deterministic fallback. **Live gate:** `npx tsx scripts/advise-live.ts` → 3/3 fixture summaries return AI plans (5–19 s), plans read and sensible. 113 app tests |
| P10 Quantum Pass flow e2e | 🟨 | 21 Nov | QoreX supports native hybrid txs only → v2 contract adds `attest()` path (proof = hybrid native self-transfer w/ memo, verified by /api/attest; registry re-checked on-chain). v2 `0x4f54b696…56df`; live E2E with fresh account: proof `926E749D…E55F` → attest `0x872179a1…2f60`. 18 Foundry + 105 app tests. /pass stepper (scan → QoreX → key → sign and mint → done). 👤 pending: run with real QoreX extension; E2E smoke now via `npm run e2e` (playwright-core driving installed Edge, 9/9 on 22 Nov); QoreX wallet steps stay manual |
| P11 Dashboard, share, E2E, deploy | 🟨 | 21 Nov | /dashboard reads counters + PassMinted logs (paged) live from v2; ShareCard 1200×675 SVG→PNG + X intent, no addresses; vercel.json (/lcd-testnet rewrite, security headers, fn timeouts); tsc errors fixed. 👤 pending: Vercel deploy + env vars (ANTHROPIC_API_KEY, QORE_ATTESTER_MNEMONIC testnet), live URL, Lighthouse. E2E: `npm run e2e` 9/9 (landing, validation, live genesis scan + evidence, plan, methodology anchors, live dashboard, theme, 390px no-overflow + menu, no page errors). Pages code-split (app chunk 60 kB). Scan shows **Scan incomplete + Retry** (never "no funds"/safe) when a balance source is down |
| P12 Security review + docs | 🟨 | 21 Nov | docs/SECURITY_REVIEW.md: 0 critical/high in our code, 1 medium fixed (attest rate limit), transitive audit highs triaged as unreachable; final README (requirements→proof table, limits); AI_USAGE.md final. 👤 read-through pending |
| P13 Video, cover, submission | 🟨 | 21 Nov | docs/VIDEO_SCRIPT.md (2:45, exact clicks + cues), docs/cover.png (1920×1080, 724 KB, from cover.html), docs/PROJECT_PAGE.md (534-char description, kits, addresses), docs/SOCIAL.md. tsc clean, 105 + 18 tests. 👤 record + upload video, upload cover, fill project page, install QoreChain Build GitHub App, Vercel deploy, re-read /rules |
| UI v2 polish | ✅ | 22 Nov | Landing rebuilt from docs/design/inspiration.md direction: blueprint grid + grain + aurora glow, Instrument Serif accents, live chip, chain marquee, attacker-view terminal, bento w/ cursor spotlight, 4-verdict cards, timeline, FAQ, CTA band, multi-column footer w/ wordmark; mobile menu, sun/moon toggle, count-ups, scroll reveal (all off under reduced-motion). Inner pages: unified headers. Verified via headless Edge screenshots (desktop + 390px) incl. a live genesis-key scan |

Legend: ⬜ not started · 🟨 in progress · 🟥 gate failed · ✅ done


## 22 Nov 2026 — UI v3, workflows, benchmark, deploy

- ✅ UI v3 "Q-Day Observatory" (original design, direction from docs/design/inspiration.md).
- ✅ User-workflow suite `npm run workflows` — 21/21 against production.
- ✅ Benchmark vs BitGo, Project Eleven, svanstaa CLI, Quantus, stablepqc — docs/BENCHMARK.md.
- ✅ Deployed to Vercel: https://shors-reach.vercel.app (frontend + /api/advise + /api/attest). Env: GEMINI_API_KEYS, ADVISOR_MODEL, QORE_ATTESTER_MNEMONIC (Production + Preview). Render not needed — both APIs run as Vercel functions.
- ✅ Fixes surfaced by testing: BTC scan degrades gracefully; mempool.space → blockstream.info failover; /api/attest bundled (ERR_REQUIRE_ESM in @cosmjs); wallet stack lazy-loaded.
- ✅ Demo video uploaded: https://youtu.be/4W-PkwzndHk (linked in README + PROJECT_PAGE).
- ⏳ User-only: real QoreX run on /pass, submission page, rotate the API keys shared in chat after the hackathon.

## 22 Nov 2026 — branch feat/api-watchlist-qa (merged)

- ✅ Plan follow-up Q&A (/api/ask) — anonymised summary only, input + output guards, rule-based fallback.
- ✅ Watchlist (on-device) + opt-in email/Telegram alerts (/api/alerts, daily cron). Alerts stay "not switched on" until storage + a channel are configured (user step).
- ✅ Public Scan API v1 (/api/v1/scan) + embeddable widget (public/widget.js) + #/developers.
- ✅ 172 unit tests; workflows 34/34 on dev; preview smoke via vercel curl (all endpoints).
- ⏳ User: provision Upstash Redis + Resend or a Telegram bot to switch alerts on.

## 22 Nov 2026 — Telegram alerts live

- ✅ @ShorsReachBot: profile, commands, avatar set via Bot API; webhook → /api/alerts?action=telegram (secret-checked); daily cron authorised by CRON_SECRET.
- ✅ Storage: Upstash Redis (upstash-kv-sky-xylophone) connected to Production + Preview.
- ✅ Workflows 35/35 on production incl. the Telegram journey (Start simulated via the webhook).
- ⏳ User: real end-to-end try from a phone; rotate the bot token (/revoke) and the Upstash token (both were pasted in chat).
