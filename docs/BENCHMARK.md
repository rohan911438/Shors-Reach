# Benchmark — Shor's Reach vs existing quantum-exposure tools

_Last updated 22 Nov 2026. Competitor facts come only from their public pages or press coverage (linked). Where a source does not say, we write **not stated** rather than guess._

## 1. The landscape

| Tool | What it is | Input | Chains |
|---|---|---|---|
| **BitGo — Bitcoin Quantum Resistance Score** ([page](https://www.bitgo.com/btc-quantum-resistance-score/), [coverage](https://thepaypers.com/crypto-web3-and-cbdc/news/bitgo-launches-public-bitcoin-quantum-risk-checker)) | Public web checker; reports the share of BTC in addresses whose keys are exposed | One or several Bitcoin addresses | Bitcoin |
| **Project Eleven — Bitcoin Risq List / Yellowpages** ([coverage](https://www.theblock.co/news/deals/2026-01-14-project-eleven-series-a-funding-crypto-quantum-threats-385583), [audit](https://cure53.de/audit-report_project-11-crypto.pdf)) | Risq List: aggregate public tracker of vulnerable BTC. Yellowpages: binds an existing address to a post-quantum keypair with a timestamped proof, no coins moved | Risq List: none (aggregate). Yellowpages: a Bitcoin address you control | Bitcoin |
| **svanstaa/quantum-vuln-addresses** ([GitHub](https://github.com/svanstaa/quantum-vuln-addresses)) | Open-source CLI that scans the whole chain on your own node and totals exposed value | None (whole UTXO set) | Bitcoin |
| **Quantus — Quantum Risk Checker** ([page](https://quantus-website.pages.dev/quantum-risk-checker/)) | Web checker that grades an Ethereum address (has it sent a tx, how much ETH) | One Ethereum address | Ethereum |
| **stablepqc** ([page](https://stablepqc.pages.dev/)) | Web checker: is this Ethereum address's public key already on-chain? | One Ethereum address | Ethereum |
| **Shor's Reach** (this project) | Key-level exposure scan with evidence → AI plan → post-quantum lock-in on QoreChain with an on-chain-verified pass | BTC address, BTC public key, xpub/ypub/zpub, 0x address, qor1 address | Bitcoin + 7 EVM chains + QoreChain |

## 2. Capability matrix

✓ = yes · — = no · **n/s** = not stated by the source

| Capability | BitGo | Project Eleven | svanstaa CLI | Quantus | stablepqc | **Shor's Reach** |
|---|---|---|---|---|---|---|
| Per-user scan in the browser, no install | ✓ | Yellowpages app | — (needs a full node) | ✓ | ✓ | ✓ |
| Multiple addresses / whole HD wallet (xpub) | several addresses · xpub n/s | n/s | whole chain (aggregate) | — | — | ✓ xpub gap scan |
| Derives **every sibling form** of one key (P2PKH, P2WPKH, P2SH-P2WPKH, P2TR, P2PK…) | n/s | n/s | matches cross-type reuse (aggregate) | — | — | ✓ 7 forms per key |
| Finds **P2PK** coins (no address at all) | n/s | Risq List counts them | ✓ | — | — | ✓ from a public key |
| Taproot output key treated as exposed on receipt | n/s | n/s | n/s | — | — | ✓ |
| **Cross-chain** EVM (one tx anywhere exposes the key everywhere) | — | — | — | Ethereum only | Ethereum only | ✓ 7 EVM chains |
| **Evidence**: the tx that revealed each key, linked | n/s | n/s | aggregate only | n/s | n/s | ✓ every red row (enforced invariant) |
| Never says "safe" without data (Unknown state) | n/s | n/s | n/s | n/s | n/s | ✓ |
| Addresses stay on the device | "not stored" (server-side lookup) | n/s | ✓ local | n/s | n/s | ✓ scan runs in the browser |
| Personalised remediation plan | — (institutional workflow only) | — | — | n/s | — | ✓ AI (anonymised input) + rule-based fallback |
| Post-quantum protection you can act on today | — | Yellowpages: off-chain PQ binding | — | — | — | ✓ register ML-DSA-87 on QoreChain (hybrid sigs required) |
| **On-chain verified proof** | — | timestamped proof (off-chain) | — | — | — | ✓ Quantum Pass, ML-DSA-87 checked via precompiles 0x0a01/0x0a02 |
| Follow-up Q&A on your own result | — | — | — | — | — | ✓ anonymised, guarded, rule-based fallback |
| Monitoring: alert when a key gets revealed | n/s | n/s | — | — | — | ✓ on-device watchlist + opt-in email/Telegram |
| API / embeddable widget for wallets & exchanges | n/s | n/s | CLI only | n/s | n/s | ✓ `POST /api/v1/scan` + 2-line widget |
| Follow-up Q&A on your own result | — | — | — | — | — | ✓ anonymised, guarded, rule-based fallback |
| Monitoring: alert when a key gets revealed | n/s | n/s | — | — | — | ✓ on-device watchlist + opt-in email/Telegram |
| API / embeddable widget for wallets & exchanges | n/s | n/s | CLI only | n/s | n/s | ✓ `POST /api/v1/scan` + 2-line widget |
| Open source | n/s | Yellowpages ✓ (audited) | ✓ | n/s | n/s | ✓ MIT |

**Where others are ahead, honestly:** BitGo brings brand trust and institutional migration tooling. Project Eleven has an audited Bitcoin-native registry and a canonical aggregate tracker. The svanstaa CLI scans the entire UTXO set, which a browser tool cannot. Shor's Reach is a testnet hackathon build. Its pass lives on QoreChain, not on Bitcoin.

**Where Shor's Reach is different:** it works at the level of **keys**, not addresses, across **chains**, proves every verdict with a **linked transaction**, and ends in an **action verified on-chain with a post-quantum signature**, not only a score.

## 3. Measured accuracy: key-level vs single-address check

Reproduce: `cd app && npx tsx scripts/benchmark.ts --report ../docs/reports/benchmark-accuracy.md` (live data; latest run in [reports/benchmark-accuracy.md](reports/benchmark-accuracy.md)).

**Baseline** = the rule a single-address checker applies. It looks at one address and calls it exposed only if that address has spent (Bitcoin) or has an Ethereum nonce > 0.

Run of 22 Nov 2026:

| Case | Baseline verdict | Baseline exposed | Shor's Reach exposed | Exposed rows with evidence |
|---|---|---|---|---|
| Satoshi's genesis key | **Safe** (address never spent) | $0 | **$6.35M** | 4 / 4 |
| Taproot address | **Safe** (never spent) | $0 | **$156** | 1 / 1 |
| Exchange cold wallet (reused P2SH; control) | Exposed | $14.66B | $14.66B | 1 / 1 |
| vitalik.eth | Exposed (Ethereum only) | $9.6K | **$15.5K** across 7 chains | 8 / 8 |

- **2 of 4 non-control cases** get a false **"safe"** from the single-address rule. Shor's Reach finds and proves the exposure.
- Exposed value found in the non-control cases: **$9.6K → $6.37M** (~660×).
- **14 / 14** exposed rows link to the on-chain transaction or output that proves them.
- The control case agrees, as it should.

The HD-wallet case (BIP-84 test zpub) is in the script. On 22 Nov, mempool.space rate-limited the gap scan. That surfaced a real bug, now fixed: one timed-out sibling lookup used to discard the whole Bitcoin result. Failed lookups now become **Unknown** rows while proven results are kept, with a regression test in `engine.test.ts`.

## 4. Performance and quality (measured)

| Metric | Result | How |
|---|---|---|
| User-workflow tests (production) | **21 / 21** steps, 5 personas, live chains + live AI, on shors-reach.vercel.app | `npm run workflows -- <url>` → [reports/workflows-production.md](reports/workflows-production.md) |
| E2E smoke | 9 / 9 | `npm run e2e` |
| Unit / engine tests | 172 app + 18 Foundry | `npm test`, `forge test` |
| Scan time (live) | genesis key ~7–9 s · Taproot ~2–4 s · EVM 8 chains ~3–6 s · reused P2SH ~10–19 s | benchmark script |
| AI plan latency (Gemini 3.5 Flash, low thinking) | 5–19 s; rule-based fallback is instant | `npm run advise:live` |
| Lighthouse, production, desktop | Performance 88 · Accessibility 95 · Best practices 100 · SEO 100 · FCP 0.9 s · LCP 1.4 s · CLS 0.006 | lighthouse 12.6 |
| Lighthouse, production, mobile (median of 3, 4× CPU throttle) | Performance 62 · Accessibility 95 · Best practices 100 · SEO 100 · FCP 2.5 s · LCP 4.1 s · CLS 0.01 | lighthouse 12.6 |
| Initial JS | wallet stack (~310 kB gzip) moved off the critical path: it loads only when "Connect Wallet" is clicked | `vite build` |
| Mobile (390 px) | no horizontal overflow on home, dashboard, methodology | workflows D |

Known gap: mobile Performance (62) is held back by the size of the animated landing page under 4× CPU throttling (main-thread render of the hero). Desktop is 88. Data sources are resilient: Bitcoin lookups fail over from mempool.space to blockstream.info on rate limits, 5xx or timeouts.
