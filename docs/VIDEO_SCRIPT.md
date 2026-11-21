# Video script — Shor's Reach (target 2:45, hard limit 3:00)

Record at 1920×1080, browser zoom 110 %, dark theme, QoreX installed and unlocked on **testnet**, a scan already warmed
once (so APIs are cached). Hide bookmarks bar. Narration in plain words; on-screen text in **[brackets]**.

| Time | Screen (exact clicks) | Narration | On-screen text |
|---|---|---|---|
| 0:00–0:12 | Landing page, cursor still on the headline | "Satoshi's address has never sent a single coin. Every address checker calls it safe. It isn't." | **[How much of your crypto dies on Q-Day?]** |
| 0:12–0:30 | Click chip **Try: Satoshi's genesis key** → progress list animates | "A quantum computer doesn't need your address — it needs your public key. Shor's Reach scans keys, not addresses: seven Bitcoin address forms per key, raw-key outputs that have no address at all, every EVM chain." | **[Key-level scan · runs in your browser]** |
| 0:30–0:50 | Results: big red number, gauge. Click **Why?** on the first row, then **Evidence ↗** (mempool.space opens on the genesis coinbase) → back | "Four holdings, all exposed now. And every red row comes with the transaction that proves it — here, block zero itself. No evidence, no alarm." | **[Every verdict links to its proof]** |
| 0:50–1:05 | Paste `vitalik.eth`'s address (chip **Try: vitalik.eth**) → results | "On EVM chains, one transaction on any chain exposes the key on all of them. It also checks the QoreChain account: no post-quantum key registered — whoever breaks ECDSA first could register theirs." | **[1 tx anywhere = exposed everywhere]** |
| 1:05–1:25 | Click **Get my plan** → plan renders; click **Show raw JSON** | "An AI advisor turns this into a calm, ordered plan. It only ever sees this anonymised summary — no addresses, no transactions, no exact amounts. If the AI is down, a rule-based plan takes over." | **[Claude Opus 5.5 · anonymised input · guardrails both ways]** |
| 1:25–1:35 | Click **Quantum Pass** in the nav | "On QoreChain, every native transaction needs a hybrid signature: secp256k1 plus ML-DSA-87. Breaking ECDSA alone moves nothing — once your key is registered." | **[Hybrid signatures: required]** |
| 1:35–2:10 | Step 2 **Connect QoreX** → approve in QoreX. Step 3 shows key registered. Step 4 shows buckets → **Sign proof & mint pass** → QoreX shows the self-transfer + memo → approve → status messages → Done with two tx links | "Connect QoreX. My ML-DSA key is registered. The pass commits to my scan — only coarse buckets and a salted hash. QoreX signs a tiny self-transfer with my post-quantum key; the chain only accepts it with a valid hybrid signature. That committed transaction is the proof — and the contract re-checks my key in QoreChain's PQC registry before minting a soulbound pass." | **[Proof = hybrid-signed native tx]** |
| 2:10–2:22 | Click the **Proof** link → explorer shows the tx; zoom on the `PQCHybridSignature` extension | "Here it is on the explorer: the ML-DSA-87 layer, algorithm one." | **[secp256k1 + ML-DSA-87 on-chain]** |
| 2:22–2:35 | Click **See the public counter** → dashboard numbers + latest passes | "A public counter of who has moved under post-quantum protection — read straight from the contract. Accounts that can sign EVM transactions can even mint with an ML-DSA signature verified fully on-chain by QoreChain's precompile." | **[Live from QuantumPass on qorechain-diana]** |
| 2:35–2:45 | Scroll to share card, then Methodology → **Limits** | "It's a diagnosis, not a rescue, and the limits are on the page. Scan yours — no wallet needed." | **[Shor's Reach · #BuildBeforeQDay]** |

## Checklist before recording
- [ ] Vercel prod URL works in a fresh incognito window (scan + plan).
- [ ] `ANTHROPIC_API_KEY` set in Vercel (badge shows **AI-generated**), `QORE_ATTESTER_MNEMONIC` set (testnet).
- [ ] The recording account has a registered PQ key, ≥ 1 QOR, and **no pass yet** (one per account).
- [ ] Explorer link for the proof tx opens.
- [ ] Final cut ≤ 3:00; upload; add link to README + project page.
