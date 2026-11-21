# 07 — Security & privacy

## Data handling
| Data | Where it goes | Never goes |
|---|---|---|
| BTC address / xpub | Browser only; per-address queries to mempool.space (disclosed) | Our server, logs, analytics, Claude |
| EVM address | Browser → public RPCs | Our server, Claude |
| Scan summary (anonymised) | `/api/advise` → Claude | Stored anywhere |
| Pass data | QoreChain testnet (public) | — only coarse buckets + hash, no addresses of other chains |
| Private keys / seeds | **Never requested** | — |

- xpub derivation is local; the xpub string never leaves the device.
- Scan input lives in the URL fragment (`#`), which browsers don't send to servers.
- Optional custom Esplora endpoint for privacy-conscious users.
- On-chain Pass stores `scanHash` (salted with a random client-side nonce) so the scan can't be brute-forced back to addresses.

## Threat model (short)
| Threat | Mitigation |
|---|---|
| Phishing clone asks for seeds | App never asks; UI banner "We will never ask for your seed" |
| False "safe" verdict | No evidence → never PROTECTED for BTC/EVM; source failure → UNKNOWN |
| False alarm | EXPOSED_NOW requires evidence tx |
| Claude API key leak | Server-side only; env var on Vercel; rate limits |
| Prompt injection via data | Advisor input is strict schema of enums/numbers only — no free text from chain |
| Contract abuse (spam mints) | One pass per account; PQ key + signature required; window scoped by user |
| Fake counters | Dashboard reads chain directly; buckets are self-reported and labelled as such |
| Dependency risk | Pin versions; `npm audit` in CI |

## Disclosure in README
Self-reported buckets, testnet-only Pass, limits of the scan, data flows above.
