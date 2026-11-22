# User-workflow test report

Run: 2026-11-22T06:56:34.655Z · target: `http://localhost:5317` · browser: headless Edge (playwright-core) · live chain data

**20/20 steps passed.**

| Persona | Step | Result | Time | Notes |
|---|---|---|---|---|
| A. Curious newcomer | lands on the home page and sees the hero + live counter | ✅ | 4.3 s | hero visible in 3246 ms |
| A. Curious newcomer | clicks the 'Satoshi's genesis key' example | ✅ | 5.8 s | 4 exposed holdings · headline $6.4M |
| A. Curious newcomer | opens 'Why?' and the evidence link points to a block explorer | ✅ | 0.1 s | https://mempool.space/tx/4a5e1e4b… |
| A. Curious newcomer | follows the methodology deep link for that reason | ✅ | 0.2 s | /methodology/btc-p2pk-output |
| A. Curious newcomer | gets a plan from the advisor | ✅ | 8.2 s | AI-GENERATED · GEMINI-3.5-FLASH · 2 actions |
| A. Curious newcomer | inspects exactly what the advisor saw (no identifiers) | ✅ | 0.1 s | 912 chars, no addresses/keys |
| B. EVM user | pastes an EVM address and scans | ✅ | 5.9 s | 8 rows |
| B. EVM user | sees the QoreChain account status panel | ✅ | 0.0 s |  |
| B. EVM user | clicks 'Protect on QoreChain' → Quantum Pass stepper | ✅ | 0.2 s | without the extension: "Connect QoreX (not detected)" |
| B. EVM user | is offered a QoreX install link | ✅ | 0.0 s |  |
| C. Careful user | garbage input shows a clear error, no navigation | ✅ | 0.9 s | Paste a Bitcoin address, a Bitcoin public key, an xpub/ypub/zpub, a 0x address or a qor1 address. |
| C. Careful user | a pasted seed phrase is refused | ✅ | 0.4 s | That looks like a seed phrase. Never paste it anywhere — not here, not into any website. We only need a public address or key. If you've shared it before, move your funds to a new wallet. |
| C. Careful user | an xpub is detected as an HD wallet | ✅ | 0.1 s |  |
| D. Mobile visitor (390px) | home has no horizontal overflow | ✅ | 2.3 s |  |
| D. Mobile visitor (390px) | story and pass band render | ✅ | 0.2 s |  |
| D. Mobile visitor (390px) | opens the menu and navigates to the dashboard | ✅ | 1.8 s |  |
| D. Mobile visitor (390px) | methodology readable without overflow | ✅ | 0.1 s |  |
| E. Returning visitor | theme choice persists across a reload | ✅ | 3.5 s | theme=light |
| E. Returning visitor | a shared deep link to a scan restores the results | ✅ | 6.8 s |  |
| All | no uncaught page errors in any journey | ✅ | 0.0 s |  |

Reproduce: `cd app && npm run dev` then `npx tsx scripts/workflows.ts http://localhost:5173 --report ../docs/reports/workflows.md`.
