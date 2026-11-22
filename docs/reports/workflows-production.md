# User-workflow test report

Run: 2026-11-22T11:07:00.252Z · target: `https://shors-reach.vercel.app` · browser: headless Edge (playwright-core) · live chain data

**34/34 steps passed.**

| Persona | Step | Result | Time | Notes |
|---|---|---|---|---|
| A. Curious newcomer | lands on the home page and sees the hero + live counter | ✅ | 7.5 s | hero visible in 6081 ms |
| A. Curious newcomer | clicks the 'Satoshi's genesis key' example | ✅ | 17.4 s | 4 exposed holdings · headline $6.5M |
| A. Curious newcomer | opens 'Why?' and the evidence link points to a block explorer | ✅ | 0.1 s | https://mempool.space/tx/4a5e1e4b… |
| A. Curious newcomer | follows the methodology deep link for that reason | ✅ | 0.5 s | /methodology/btc-p2pk-output |
| A. Curious newcomer | gets a plan from the advisor | ✅ | 14.4 s | AI-GENERATED · GEMINI-3.5-FLASH · 2 actions |
| A. Curious newcomer | asks a follow-up question about the plan | ✅ | 6.6 s | AI · GEMINI-3.5-FLASH · Your holdings are flagged red because their public keys are already ex… |
| A. Curious newcomer | an address pasted into a question is refused locally | ✅ | 0.2 s |  |
| A. Curious newcomer | inspects exactly what the advisor saw (no identifiers) | ✅ | 0.2 s | 914 chars, no addresses/keys |
| B. EVM user | pastes an EVM address and scans | ✅ | 5.4 s | 8 rows |
| B. EVM user | sees the QoreChain account status panel | ✅ | 0.0 s |  |
| B. EVM user | clicks 'Protect on QoreChain' → Quantum Pass stepper | ✅ | 0.9 s | without the extension: "Connect QoreX (not detected)" |
| B. EVM user | lazy Connect Wallet button loads the wallet stack and opens the modal | ✅ | 1.0 s | modal lists: Connect a Wallet
Recommended
QoreX
Brow er Wallet
What i  a  |
| B. EVM user | is offered a QoreX install link | ✅ | 0.0 s |  |
| C. Careful user | garbage input shows a clear error, no navigation | ✅ | 0.4 s | Paste a Bitcoin address, a Bitcoin public key, an xpub/ypub/zpub, a 0x address or a qor1 address. |
| C. Careful user | a pasted seed phrase is refused | ✅ | 1.1 s | That looks like a seed phrase. Never paste it anywhere — not here, not into any website. We only need a public address or key. If you've shared it before, move your funds to a new wallet. |
| C. Careful user | an xpub is detected as an HD wallet | ✅ | 0.0 s |  |
| D. Mobile visitor (390px) | home has no horizontal overflow | ✅ | 18.9 s |  |
| D. Mobile visitor (390px) | story and pass band render | ✅ | 0.1 s |  |
| D. Mobile visitor (390px) | opens the menu and navigates to the dashboard | ✅ | 3.7 s |  |
| D. Mobile visitor (390px) | methodology readable without overflow | ✅ | 0.1 s |  |
| E. Returning visitor | theme choice persists across a reload | ✅ | 3.6 s | theme=light |
| E. Returning visitor | a shared deep link to a scan restores the results | ✅ | 31.4 s |  |
| F. Partner developer (wallet / exchange) | API answers a CORS preflight and a scan from a foreign origin | ✅ | 12.0 s | verdict=exposed, 1 holding(s) |
| F. Partner developer (wallet / exchange) | API refuses a seed phrase and a GET with the input in the URL | ✅ | 0.8 s |  |
| F. Partner developer (wallet / exchange) | reads the developer docs and runs the playground | ✅ | 5.9 s | HTTP 200 · 1569 ms |
| F. Partner developer (wallet / exchange) | the embedded widget scans in its iframe and emits shorsreach:result | ✅ | 24.4 s | EXPOSED · {"verdict":"exposed","score":100,"exposedUsd":161} |
| F. Partner developer (wallet / exchange) | input-mode widget (light theme) accepts an address | ✅ | 2.2 s | EXPOSED |
| G. Watchlist user | scans a Taproot address and presses '+ Watch' | ✅ | 2.7 s |  |
| G. Watchlist user | the watchlist shows it with a score, and survives a reload | ✅ | 20.7 s | score 100 |
| G. Watchlist user | 'Check now' re-scans and reports no changes | ✅ | 10.3 s |  |
| G. Watchlist user | a revealed key since the last visit raises an alert and a nav badge | ✅ | 1.2 s | badge 2 |
| G. Watchlist user | the alerts section is honest about what's enabled | ✅ | 0.0 s | disabled on this deployment (notice shown) |
| G. Watchlist user | removes the entry | ✅ | 0.1 s |  |
| All | no uncaught page errors in any journey | ✅ | 0.0 s |  |

Reproduce: `cd app && npm run dev` then `npx tsx scripts/workflows.ts http://localhost:5173 --report ../docs/reports/workflows.md`.
