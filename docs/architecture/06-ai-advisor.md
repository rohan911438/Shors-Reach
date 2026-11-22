# 06 — AI advisor

## Role
Turn a technical scan result into a calm, prioritised, personal plan. It is a product feature (Best AI-Native Build), not decoration.

## Endpoint
`POST /api/advise` — Vercel Node function (default Node runtime). Secrets: `GEMINI_API_KEYS` (comma separated, rotated on 401/403/429) or `GEMINI_API_KEY`. Model from env `ADVISOR_MODEL`, default `gemini-3.5-flash`, called over REST with `responseJsonSchema` and `thinkingLevel: low`. Output guard: identifier leak filter + negation-aware secret-request filter ("never share your seed" passes, "paste your seed" fails).

## Input (anonymised — validated server-side, anything else rejected)
```json
{
  "score": 62,
  "totalsUsdRounded": { "EXPOSED_NOW": 12000, "EXPOSED_ON_SPEND": 3000, "UNKNOWN": 500, "PROTECTED": 0 },
  "holdings": [ { "chain": "bitcoin", "format": "p2tr", "status": "EXPOSED_NOW", "reason": "taproot-output-key", "usdRounded": 8000 } ],
  "questionnaire": { "signedMessages": "unsure", "custodial": false },
  "qorechain": { "pqKeyRegistered": false, "windowLive": false }
}
```
No addresses, txids, xpubs or exact amounts. USD rounded to 2 significant figures. Max 50 holdings.

## Output (JSON, schema-validated; rendered by UI)
```json
{
  "summary": "two calm sentences",
  "actions": [ { "priority": 1, "title": "...", "why": "...", "how": "..." } ],
  "stopDoing": [ "..." ],
  "unknowns": [ "..." ],
  "qorechainNote": "..."
}
```
Use structured output / tool-style JSON schema; retry once on invalid JSON; on failure show a deterministic rule-based fallback plan (so the demo never breaks).

## System prompt rules
- Explain long- vs short-exposure; don't predict Q-Day dates; cite that estimates vary.
- Never ask for or mention seeds/private keys except to say "never share them".
- No financial advice framing; no token shilling; QoreChain mentioned factually as one PQ option available today.
- Bitcoin advice: move from exposed outputs to fresh, never-reused hash-based addresses (P2WPKH) and stop address reuse;
  note Taproot's at-rest exposure; note BIP-360 is a draft.
- EVM advice: a fresh, never-used EOA is only hidden until its first tx; smart accounts / PQ options are emerging.

## Safety & cost
- Rate limit per IP (e.g. 10/hour) in the function.
- `max_tokens` ~1,200. Log only token counts, never payloads.
- Tests: schema validation, rejects payload containing an address-like string, fallback path.
