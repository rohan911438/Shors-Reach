# User-workflow test report

Run: 2026-11-22T12:44:43.523Z · target: `https://shors-reach.vercel.app` · browser: headless Edge (playwright-core) · live chain data

**35/35 steps passed.**

| Persona | Step | Result | Time | Notes |
|---|---|---|---|---|
| A. Curious newcomer | lands on the home page and sees the hero + live counter | ✅ | 6.1 s | hero visible in 5203 ms |
| A. Curious newcomer | clicks the 'Satoshi's genesis key' example | ✅ | 5.3 s | 4 exposed holdings · headline $6.5M |
| A. Curious newcomer | opens 'Why?' and the evidence link points to a block explorer | ✅ | 1.3 s | https://mempool.space/tx/4a5e1e4b… |
| A. Curious newcomer | follows the methodology deep link for that reason | ✅ | 1.4 s | /methodology/btc-p2pk-output |
| A. Curious newcomer | gets a plan from the advisor | ✅ | 2.1 s | RULE-BASED PLAN · 3 actions |
| A. Curious newcomer | asks a follow-up question about the plan | ✅ | 21.3 s | AI · GEMINI-3.5-FLASH · Your holdings show as red because their public keys are already visibl… |
| A. Curious newcomer | an address pasted into a question is refused locally | ✅ | 1.0 s |  |
| A. Curious newcomer | inspects exactly what the advisor saw (no identifiers) | ✅ | 0.9 s | 914 chars, no addresses/keys |
| B. EVM user | pastes an EVM address and scans | ✅ | 10.6 s | 8 rows |
| B. EVM user | sees the QoreChain account status panel | ✅ | 0.0 s |  |
| B. EVM user | clicks 'Protect on QoreChain' → Quantum Pass stepper | ✅ | 1.3 s | without the extension: "Connect QoreX (not detected)" |
| B. EVM user | lazy Connect Wallet button loads the wallet stack and opens the modal | ✅ | 2.6 s | modal lists: Connect a Wallet
Recommended
QoreX
Brow er Wallet
What i  a  |
| B. EVM user | is offered a QoreX install link | ✅ | 0.3 s |  |
| C. Careful user | garbage input shows a clear error, no navigation | ✅ | 9.0 s | Paste a Bitcoin address, a Bitcoin public key, an xpub/ypub/zpub, a 0x address or a qor1 address. |
| C. Careful user | a pasted seed phrase is refused | ✅ | 3.0 s | That looks like a seed phrase. Never paste it anywhere — not here, not into any website. We only need a public address or key. If you've shared it before, move your funds to a new wallet. |
| C. Careful user | an xpub is detected as an HD wallet | ✅ | 0.3 s |  |
| D. Mobile visitor (390px) | home has no horizontal overflow | ✅ | 9.3 s |  |
| D. Mobile visitor (390px) | story and pass band render | ✅ | 0.4 s |  |
| D. Mobile visitor (390px) | opens the menu and navigates to the dashboard | ✅ | 0.9 s |  |
| D. Mobile visitor (390px) | methodology readable without overflow | ✅ | 0.5 s |  |
| E. Returning visitor | theme choice persists across a reload | ✅ | 7.5 s | theme=light |
| E. Returning visitor | a shared deep link to a scan restores the results | ✅ | 8.2 s |  |
| F. Partner developer (wallet / exchange) | API answers a CORS preflight and a scan from a foreign origin | ✅ | 2.9 s | verdict=exposed, 1 holding(s) |
| F. Partner developer (wallet / exchange) | API refuses a seed phrase and a GET with the input in the URL | ✅ | 0.7 s |  |
| F. Partner developer (wallet / exchange) | reads the developer docs and runs the playground | ✅ | 3.1 s | HTTP 200 · 1447 ms |
| F. Partner developer (wallet / exchange) | the embedded widget scans in its iframe and emits shorsreach:result | ✅ | 1.3 s | EXPOSED · {"verdict":"exposed","score":100,"exposedUsd":161} |
| F. Partner developer (wallet / exchange) | input-mode widget (light theme) accepts an address | ✅ | 12.8 s | EXPOSED |
| G. Watchlist user | scans a Taproot address and presses '+ Watch' | ✅ | 2.9 s |  |
| G. Watchlist user | the watchlist shows it with a score, and survives a reload | ✅ | 0.9 s | score 100 |
| G. Watchlist user | 'Check now' re-scans and reports no changes | ✅ | 1.2 s |  |
| G. Watchlist user | a revealed key since the last visit raises an alert and a nav badge | ✅ | 1.3 s | badge 2 |
| G. Watchlist user | the alerts section is honest about what's enabled | ✅ | 0.0 s | Telegram enabled: 3-step guide shown |
| G. Watchlist user | Telegram onboarding: tap 🔔 → Telegram opens → Start → card turns green → turn off | ✅ | 48.9 s | popup → https://t.me/ShorsReachBot?start=… · connected · turned off |
| G. Watchlist user | removes the entry | ✅ | 0.1 s |  |
| All | no uncaught page errors in any journey | ✅ | 0.0 s |  |

Reproduce: `cd app && npm run dev` then `npx tsx scripts/workflows.ts http://localhost:5173 --report ../docs/reports/workflows.md`.
