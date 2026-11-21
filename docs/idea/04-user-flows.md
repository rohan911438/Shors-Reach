# 04 — User flows

## Personas
| Persona | Has | Wants |
|---|---|---|
| **Holder Hana** | BTC on a hardware wallet (xpub), some ETH/Base | "Am I exposed? What should I do?" |
| **Builder Bo** | EVM dev, curious about QoreChain | "What does PQ protection actually change for me?" |
| **Juror J** | 3 minutes, a laptop | Clear demo, real tx hashes, honest limits |

## Flow A — Scan (no wallet needed)
1. Landing: headline counter + "Paste a Bitcoin address, xpub or 0x address".
2. Input is detected automatically (address type / xpub / EVM).
3. Progress: "Checking 7 key formats… 8 EVM chains… pricing…".
4. Result:
   - Big number: **$X exposed now** · $Y exposed when you spend · $Z unknown.
   - Table: chain · format · amount · status · reason · evidence link.
   - "Why?" drawer per row explains the rule in one paragraph.
5. Optional 3-question questionnaire ("Have you ever signed a message with this wallet?") — moves UNKNOWN items.
6. CTA: "Get your plan" and "Protect yourself on QoreChain".

## Flow B — AI plan
1. App sends **only** the anonymised summary (formats, statuses, rounded values, chain names — no addresses).
2. Claude returns: 3–5 prioritised actions, what to stop doing, what stays unknown, a calm risk explanation.
3. Rendered with clear "this is not financial advice" note.

## Flow C — Quantum Pass (QoreChain testnet)
1. Connect QoreX (testnet).
2. App reads `/pqc/v1/account` and `/pqc/v1/evm_window`:
   - Not registered → red banner: "Until you register, anyone who breaks your ECDSA key can claim this account."
   - Window open & wide → "If ECDSA broke tomorrow, max loss = X".
3. Step 1 **Register PQ key** (if needed).
4. Step 2 **Open a tight EVM window** — hybrid-signed native tx (this is the track's required hybrid tx), scoped to the
   Pass contract only, 1–2 txs, 0 value.
5. Step 3 **Sign the scan hash with ML-DSA** and **mint** the soulbound Pass (contract verifies via `0x…0A01` if the
   spike succeeds; otherwise checks key status via `0x…0A02`).
6. Success: Pass card + tx hashes + explorer links + "Share on X".

## Flow D — Public dashboard
Counter of Passes minted, total exposed value (self-reported, rounded) now attested, distribution by chain/format.
Data read straight from the contract → anyone can verify.

## Flow E — Juror's 3-minute path (the video follows this)
0:00 hook (Satoshi's "safe-looking" address) → 0:30 scan a real wallet → 1:15 evidence + AI plan → 1:45 QoreChain check
→ 2:15 mint Pass (hybrid tx on explorer) → 2:45 counter + limits.
