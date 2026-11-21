# 02 — The solution: **Shor's Reach** (working name)

> *See your crypto the way a quantum attacker sees it — then lock your QoreChain account before they can.*

## Product in one paragraph
A browser app that scans Bitcoin and EVM holdings **at the key level**, tells you exactly which coins a quantum attacker
could take and why — each verdict linked to the on-chain transaction that proves it — gives you a plain-language plan from
an AI advisor, and then walks you through the one step that actually protects an account on QoreChain: registering your
ML-DSA-87 key and minting a non-transferable **Quantum Pass** with a hybrid-signed transaction.

## The six parts
| # | Part | What the user gets |
|---|---|---|
| 1 | **Key-level scan** | BTC address / xpub / EVM address → every coin, every format, every EVM chain where the same key lives |
| 2 | **Verdict with evidence** | Per holding: EXPOSED_NOW / EXPOSED_ON_SPEND / PROTECTED / UNKNOWN + reason + proof tx. Headline: "$X open to a quantum attacker today" |
| 3 | **AI advisor** | Claude turns the anonymised result into a prioritised plan (what to move first, habits to stop, what is unknown) |
| 4 | **QoreChain check** | Is your PQ key registered? `possession_proven`? Live EVM window → "if ECDSA broke tomorrow, max loss = X" |
| 5 | **Quantum Pass** | Connect QoreX → register PQ key → open a tightly scoped EVM window (hybrid-signed tx) → mint soulbound Pass carrying an ML-DSA-signed hash of your scan |
| 6 | **Public counter + share card** | "N wallets / $X of exposed value now protected on QoreChain" + X card (#BuildBeforeQDay) |

## What makes it different
- **Key-centric, not address-centric** — catches five traps naive scanners miss (sibling formats, P2PK, Taproot, cross-EVM reuse, HD wallets).
- **Evidence for every verdict** — QoreChain's "verify, not believe", applied to risk.
- **Cross-chain** — every other Quantum Pass entry only looks at QoreChain accounts.
- **Teaches a real QoreChain insight** — unregistered accounts are not yet protected.
- **Produces a metric QoreChain can quote** — exposed value that has moved to PQ protection.

## What it deliberately does NOT do (stated in README "Limits")
- Never asks for seeds or private keys; never moves BTC/ETH.
- Off-chain signatures are invisible → "UNKNOWN", never "safe".
- Keys revealed only through a P2PK output whose address never spent need a P2PK index → partial (bundled known list).
- Custodial/exchange holdings: reported, but the user doesn't control the key.

## Name options
Shor's Reach (default) · Q-Day Exposure · KeyLight · Exposed. Final name chosen before prompt 10 (UI polish).
