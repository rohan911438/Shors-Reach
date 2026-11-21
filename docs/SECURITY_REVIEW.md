# Security & privacy review — Shor's Reach

Date: 21 Nov 2026 · Scope: whole repo (`app/`, `app/api/`, `contracts/`, scripts, CI) · Method: manual review against
`docs/architecture/07-security-privacy.md`, secret scans of tracked files **and git history**, tests.

## Summary

| Severity | Open | Fixed |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 1 |
| Low / info | 4 (accepted, documented) | 1 |
| Dependency advisories (transitive, template wallet stack) | 16 high / 13 moderate — none reachable with attacker input on our servers; see the table at the end | — |

## Findings

| # | Sev | Area | Finding | Status |
|---|---|---|---|---|
| 1 | Medium | `api/attest.ts` | No rate limit: anyone holding valid proofs could make the attester spend gas repeatedly (each proof is single-use on-chain, but failed/duplicate requests still cost RPC + window opens). | **Fixed** — 5 req/IP/hour (`src/lib/rateLimit.ts`); duplicate/used proofs are rejected *before* any tx (`hasPass`, `nativeTxUsed`). |
| 2 | Low | `api/advise.ts` | Rate limiter is per serverless instance (in-memory), so the effective limit is higher under scale-out. | Accepted for a hackathon demo; documented. Upstream Anthropic rate limits and `max_tokens` bound the cost. |
| 3 | Low | Trust model | `attest()` trusts one immutable attester to have checked the native proof. The contract still re-reads the PQC key registry (0x0a02) and binds `pqKeyHash`, and each proof tx is single-use — but a compromised attester key could mint passes for any account **that has a registered PQ key**. | Accepted & documented (README "Limits", `/pass` "How the proof works"). Testnet only; the self-mint path (`mint()`) needs no trust. Removed when QoreX ships `signArbitrary`/EVM signing. |
| 4 | Low | Pass fields | Score / chains / USD buckets are **self-reported** (from the user's own browser scan). | By design; labelled "self-reported" on `/dashboard` and in the contract docs. Nothing is paid out based on them. |
| 5 | Info | Headers | No CSP: the app talks to many public RPCs and a wallet extension. | Accepted; `Referrer-Policy: no-referrer`, `nosniff`, `Permissions-Policy` set in `vercel.json`. |
| 6 | Info | `contracts/.env.example` | Matched the secret scan only because of a zero placeholder `PRIVATE_KEY=0x000…`. | Not a secret. |

## Checks performed

**Secrets**
- `git ls-files` + full `git log -p --all` scanned for the testnet mnemonic words, `sk-ant-` keys and 32-byte hex keys: **no hits** in tracked files or history.
- `.env` and `.env.*` are gitignored (`!.env.example` only). The testnet mnemonic lives in `contracts/.env` only; the attester reads `QORE_ATTESTER_MNEMONIC` from server env. The Anthropic key is server-side only (`ANTHROPIC_API_KEY`, never `VITE_`-prefixed, so never bundled).

**Data flows vs the privacy table**
| Data | Where it goes | Check |
|---|---|---|
| Scanned address / pubkey / xpub | Browser → public data APIs (mempool.space, publicnode RPCs, QoreChain REST via same-origin proxy). Never our server. | Input lives in the URL **fragment** (never sent in HTTP requests); `Referrer-Policy: no-referrer`. |
| xpub | Expanded locally; only derived addresses are queried. | `scan/btc/scan.ts` |
| Advisor input | Anonymised summary only. | zod `.strict()` schema + identifier regexes checked **before** parsing, error never echoes input (tests). UI shows the exact payload. |
| Advisor output | Validated again; rejected if it contains an identifier or asks to share/enter a seed or key. | `src/advisor/server.ts` + tests. |
| Logs | Token counts / stop reason only. | `advise.ts` logger. |
| Pass on-chain | scanHash (salted), 3 coarse buckets, key hash. No addresses beyond the holder's own. | `QuantumPass.sol` |

**Advisor**: strict schema, 20 KB body cap, 405/400/429 paths, retry once, refusal not retried, deterministic fallback — 21 tests.

**Contract** (`QuantumPass.sol`): no owner/admin, no upgrade, immutable attester; one pass per account; range checks;
self-mint verifies ML-DSA-87 on-chain against the **registered** key (caller can't supply a key); digest binds chain id,
contract, holder and every field (fuzzed); attest re-checks registry and burns the proof hash; soulbound (all transfer/approve
paths revert); precompile failure → revert, never silent success. 18 Foundry tests incl. 2 fuzz suites and attack cases.

**Native proof verification** (`src/pass/proof.ts`): requires code 0, `PQCHybridSignature` with algorithm 1, exactly one
`MsgSend` to self, strict memo grammar with range checks; holder = tx signer. 14 tests.

**Key-registration safety**: scripts register a PQ key at most once and never retry (a second, different key is refused after the fee).

**Dependencies**: `npm audit --omit=dev` — see below.

`npm audit --omit=dev` (app, 21 Nov): 0 critical, 16 high, 13 moderate — **all transitive**, from the wallet stack that
`create-qorechain-dapp`'s viem-wagmi template ships (RainbowKit → WalletConnect/Reown AppKit, Coinbase CDP SDK, `ws`,
`query-string`/`decode-uri-component`) plus `zod`/`abitype`.

| Advisory | Reachability in Shor's Reach | Decision |
|---|---|---|
| `zod` memory exhaustion on oversized constrained collections | Our only server-side zod use parses advisor bodies **capped at 20 KB before parsing**, arrays `.max(50)` | Mitigated by the cap; accepted |
| `ws` memory disclosure / DoS | Server-side `ws` is not used by our functions (HTTP transports only); in the browser it is unused by our code paths | Accepted |
| `decode-uri-component` / `query-string` DoS | Client-side WalletConnect URL parsing only; we ship no WalletConnect wallet (QoreX + injected) | Accepted |
| Reown AppKit / CDP SDK chain | Pulled in by RainbowKit; not on any server path | Accepted; bump with the template upstream |

`npm audit fix --force` was **not** run: it would break the official template's pinned wallet stack. No finding is reachable
with attacker-controlled input on our servers beyond the capped advisor body.
