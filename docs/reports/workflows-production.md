# User-workflow test report

Run: 2026-11-22T12:06:35.146Z · target: `https://shors-reach.vercel.app` · browser: headless Edge (playwright-core) · live chain data

**35/35 steps passed.**

| Persona | Step | Result | Time | Notes |
|---|---|---|---|---|
| A. Curious newcomer | lands on the home page and sees the hero + live counter | ✅ | 4.7 s | hero visible in 2732 ms |
| A. Curious newcomer | clicks the 'Satoshi's genesis key' example | ✅ | 56.1 s | 4 exposed holdings · headline $6.6M |
| A. Curious newcomer | opens 'Why?' and the evidence link points to a block explorer | ✅ | 0.1 s | https://mempool.space/tx/4a5e1e4b… |
| A. Curious newcomer | follows the methodology deep link for that reason | ✅ | 0.6 s | /methodology/btc-p2pk-output |
| A. Curious newcomer | gets a plan from the advisor | ✅ | 9.9 s | AI-GENERATED · GEMINI-3.5-FLASH · 2 actions |
| A. Curious newcomer | asks a follow-up question about the plan | ✅ | 1.5 s | RULE-BASED ANSWER · Bitcoin addresses of the common types hide the public key behind a has… |
| A. Curious newcomer | an address pasted into a question is refused locally | ✅ | 0.1 s |  |
| A. Curious newcomer | inspects exactly what the advisor saw (no identifiers) | ✅ | 0.1 s | 914 chars, no addresses/keys |
| B. EVM user | pastes an EVM address and scans | ✅ | 36.4 s | 8 rows |
| B. EVM user | sees the QoreChain account status panel | ✅ | 0.0 s |  |
| B. EVM user | clicks 'Protect on QoreChain' → Quantum Pass stepper | ✅ | 1.0 s | without the extension: "Connect QoreX (not detected)" |
| B. EVM user | lazy Connect Wallet button loads the wallet stack and opens the modal | ✅ | 1.1 s | modal lists: Connect a Wallet
Recommended
QoreX
Brow er Wallet
What i  a  |
| B. EVM user | is offered a QoreX install link | ✅ | 0.0 s |  |
| C. Careful user | garbage input shows a clear error, no navigation | ✅ | 0.9 s | Paste a Bitcoin address, a Bitcoin public key, an xpub/ypub/zpub, a 0x address or a qor1 address. |
| C. Careful user | a pasted seed phrase is refused | ✅ | 0.3 s | That looks like a seed phrase. Never paste it anywhere — not here, not into any website. We only need a public address or key. If you've shared it before, move your funds to a new wallet. |
| C. Careful user | an xpub is detected as an HD wallet | ✅ | 0.1 s |  |
| D. Mobile visitor (390px) | home has no horizontal overflow | ✅ | 1.8 s |  |
| D. Mobile visitor (390px) | story and pass band render | ✅ | 0.2 s |  |
| D. Mobile visitor (390px) | opens the menu and navigates to the dashboard | ✅ | 0.8 s |  |
| D. Mobile visitor (390px) | methodology readable without overflow | ✅ | 0.1 s |  |
| E. Returning visitor | theme choice persists across a reload | ✅ | 3.0 s | theme=light |
| E. Returning visitor | a shared deep link to a scan restores the results | ✅ | 8.9 s |  |
| F. Partner developer (wallet / exchange) | API answers a CORS preflight and a scan from a foreign origin | ✅ | 3.0 s | verdict=exposed, 1 holding(s) |
| F. Partner developer (wallet / exchange) | API refuses a seed phrase and a GET with the input in the URL | ✅ | 0.7 s |  |
| F. Partner developer (wallet / exchange) | reads the developer docs and runs the playground | ✅ | 3.3 s | HTTP 200 · 1490 ms |
| F. Partner developer (wallet / exchange) | the embedded widget scans in its iframe and emits shorsreach:result | ✅ | 12.1 s | EXPOSED · {"verdict":"exposed","score":100,"exposedUsd":162} |
| F. Partner developer (wallet / exchange) | input-mode widget (light theme) accepts an address | ✅ | 2.9 s | EXPOSED |
| G. Watchlist user | scans a Taproot address and presses '+ Watch' | ✅ | 4.0 s |  |
| G. Watchlist user | the watchlist shows it with a score, and survives a reload | ✅ | 1.8 s | score 100 |
| G. Watchlist user | 'Check now' re-scans and reports no changes | ✅ | 2.8 s |  |
| G. Watchlist user | a revealed key since the last visit raises an alert and a nav badge | ✅ | 3.5 s | badge 2 |
| G. Watchlist user | the alerts section is honest about what's enabled | ✅ | 0.0 s | Telegram enabled: 3-step guide shown |
| G. Watchlist user | Telegram onboarding: tap 🔔 → Telegram opens → Start → card turns green → turn off | ✅ | 34.4 s | popup → https://t.me/ShorsReachBot?start=… · connected · turned off |
| G. Watchlist user | removes the entry | ✅ | 0.1 s |  |
| All | no uncaught page errors in any journey | ✅ | 0.0 s |  |

Reproduce: `cd app && npm run dev` then `npx tsx scripts/workflows.ts http://localhost:5173 --report ../docs/reports/workflows.md`.
