# 00 — How the build runs (prompt by prompt)

## The loop
```
┌─► 1. Open prompts/PROGRESS.md → find the first prompt not marked ✅
│   2. Paste the block under "PROMPT" from that file into Claude Code
│   3. Claude builds, then runs the VALIDATION GATE itself and reports each check as PASS/FAIL with evidence
│   4. Human reviews the evidence (and does any "👤 manual" checks)
│   5. All checks PASS → commit + tag pNN-done → mark ✅ in PROGRESS.md
│      Any check FAILS → paste the "IF THE GATE FAILS" block; repeat 3–4 (max 2 rounds, then re-plan with the human)
└── 6. Next prompt
```

## Rules for every prompt
1. **Read before building:** each prompt lists the docs it depends on; read them first.
2. **No skipping gates.** A later prompt assumes everything earlier is green.
3. **Evidence, not claims:** a gate result must show command output, test counts, tx hashes or screenshots.
4. **Small commits** with conventional messages; tag at the end (`p01-done` …). Commits must happen during the fest.
5. **Stay in scope:** anything not in the prompt goes to `prompts/BACKLOG.md`, not into code.
6. **Spike results** (unknown APIs) go to `architecture/spikes.md` so later prompts use facts, not guesses.
7. **Secrets** never committed (`.env*` in `.gitignore`); testnet mnemonics only in local `.env`.
8. **Update docs** when reality differs from the architecture (note it in the prompt's report).

## Schedule (today = 21 Nov; deadline 2 Dec 23:59 UTC)
| Prompt | Title | Target date | Depends on |
|---|---|---|---|
| P01 | Setup, accounts, scaffold | 21–22 Nov | — |
| P02 | QoreChain spike + first hybrid tx | 22 Nov | P01 |
| P03 | Scan engine core + BTC classification | 23 Nov | P01 |
| P04 | BTC key-level scan (pubkeys, siblings, P2PK, xpub) | 23–24 Nov | P03 |
| P05 | EVM multi-chain + QoreChain scanners | 24 Nov | P03, P02 |
| P06 | Pricing, scoring, evidence, orchestrator | 25 Nov | P04, P05 |
| P07 | QuantumPass contract + precompile spike + deploy | 25–26 Nov | P02 |
| P08 | Scan UI, results, methodology | 26–27 Nov | P06 |
| P09 | AI advisor | 27 Nov | P06 |
| P10 | Quantum Pass flow (end-to-end on testnet) | 28 Nov | P07, P08 |
| P11 | Dashboard, share card, polish, E2E, deploy | 29 Nov | P10 |
| P12 | Security/privacy review + docs (README, AI_USAGE) | 30 Nov | P11 |
| P13 | Video, cover, project page, final checks | 1 Dec (buffer 2 Dec) | P12 |
Workshop to attend if possible: 27 Nov 16:30 UTC submission clinic.

## Cut list if behind schedule (cut in this order)
1. Share card image → simple text share link
2. Safe/contract-wallet owner scanning → mark UNKNOWN
3. xpub scanning → single addresses only
4. On-chain ML-DSA verify (0x0A01) → key-status check + client-side verify (documented)
5. Dashboard charts → counters only
**Never cut:** the four track requirements, evidence links, tests, README, video, licence.
