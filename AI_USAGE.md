# AI usage — Shor's Reach

Shor's Reach applies for the **Best AI-Native Build** side award. This file explains, honestly, (1) what AI does inside the product and (2) how AI was used to build it.

## 1. AI inside the product: the advisor

| | |
|---|---|
| Where | `/plan` page → `POST /api/advise` (`app/api/advise.ts`, core in `app/src/advisor/`) |
| Model | Claude Opus 5.5 (`claude-opus-5-5`), configurable with `ADVISOR_MODEL` |
| Input | An **anonymised** scan summary only: chain, address format, verdict, reason code, USD rounded to 2 significant figures, questionnaire answers, QoreChain key/window flags. No addresses, transactions, xpubs or exact amounts. The page shows the exact JSON sent ("What the advisor saw"). |
| Guardrails (in) | Strict zod schema (unknown fields rejected); a leak filter rejects anything that looks like a Bitcoin/EVM/QoreChain address, txid or xpub **before** parsing, and the error message never echoes it; 20 KB body cap; per-IP rate limit. |
| Output | Structured JSON (`output_config.format: json_schema`): summary, prioritised actions with why/how, stop-doing, unknowns, QoreChain note. Validated again with zod. |
| Guardrails (out) | Output is rejected (→ retry once → fallback) if it is invalid, truncated, refused, contains an identifier, or asks the user to share/enter a seed or key. |
| System prompt | No Q-Day date predictions; never ask for seeds/keys; not financial advice, no token promotion; QoreChain described factually; Bitcoin/EVM migration guidance grounded in the scanner's rules. See `app/src/advisor/prompt.ts`. |
| Fallback | `app/src/advisor/fallback.ts`: a deterministic rule-based plan from the same summary. Used without an API key, on API errors or invalid output, and when the app is hosted statically. The UI badge shows **AI-generated** vs **Rule-based plan**. |
| Logging | Token counts and stop reason only — never payloads. |
| Tests | `app/src/advisor/advisor.test.ts`: schema validation, leak rejection (address/txid), fallback for 3 fixture summaries, mocked API (retry, refusal, leaky output), HTTP 400/405/429. |

What the AI does **not** do: it never decides a verdict. Exposure verdicts come from the deterministic scan engine with on-chain evidence; the AI only explains and prioritises.

## 2. AI used to build the product

- Built with **Claude Code** (Claude Opus 5.5) working through a written plan: `docs/prompts/P01…P13`, each with a **validation gate** (tests, live on-chain checks, manual review items marked 👤). Progress and evidence are tracked in `docs/prompts/PROGRESS.md`.
- Research, architecture and threat-model docs in `docs/` were drafted with Claude and reviewed by the team.
- Every on-chain claim was verified live rather than trusted: e.g. the QuantumPass contract's ML-DSA-87 verification was tested on qorechain-diana with a real signature (see `docs/architecture/spikes.md`), which is how an ABI bug in the QoreChain SDK's `pqcKeyStatus` definition was found.
- The scan engine is covered by 64 unit tests on recorded mainnet fixtures; contracts by 13 Foundry tests including fuzzing and attack cases.
- Human review: the team decides scope, reviews all generated code and copy, and holds the keys. No secrets (testnet mnemonic, API keys) are ever committed — they live in gitignored `.env` files.
