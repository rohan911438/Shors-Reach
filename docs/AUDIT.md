# Security & quality audit — Shor's Reach

_22 Nov 2026 · scope: the web app, the five serverless endpoints (`/api/advise`, `/api/ask`, `/api/attest`, `/api/alerts`, `/api/v1/scan`), the Telegram bot, the widget, dependencies, git history and the production deployment at https://shors-reach.vercel.app._

## Summary

| | Count |
|---|---|
| Findings fixed in this audit | 5 |
| Checks that passed as-is | 14 |
| Accepted risks / follow-ups | 7 |

After the fixes: **181 unit tests** pass, and the **user-workflow suite passes 35/35** (local and production), including the widget-in-iframe and Telegram journeys.

## Fixed

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Medium | **Clickjacking.** Any site could frame the full app (wallet connect, registration transactions). A `frame-ancestors` header can't be used, because the embeddable widget is served from the same path (hash route). | When framed, the app renders only an "Open Shor's Reach" link. The `#/embed/…` widget route is the only one that runs in a frame (`src/App.tsx`). |
| 2 | Medium | **Unbounded request bodies.** Every endpoint read the whole body before validating. zod 3 has an advisory for memory exhaustion when validating oversized collections. | `readCapped()` (`src/lib/http.ts`) rejects on Content-Length and while streaming, with **413**. Caps: scan 4 KB, attest 2 KB, alerts 8 KB (webhook 64 KB), advise 32 KB, ask 48 KB. 4 tests. |
| 3 | Medium (dev only) | **vitest 3.2.4: 2 critical advisories** (tinypool prototype-pollution → RCE gadget; @vitest/mocker path traversal). The test runner never ships, but runs on developer machines. | Upgraded to vitest 4.1.12; all tests pass unchanged. |
| 4 | Low | **Blocked bot = retried forever.** If a user blocked @ShorsReachBot, the daily check failed for that subscription every day. | A Telegram 403 during the cron now deletes the subscription. Test added. |
| 5 | Low | **Baseline headers missing**: no CSP at all, no COOP; HSTS only from the platform default. | Added `Content-Security-Policy: object-src 'none'; base-uri 'self'; form-action 'self'`, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (keeps the Telegram tab and wallet popups working) and explicit HSTS (`vercel.json`). |

## Checked and OK

- **Secrets:** none in the full git history. Searched for the Gemini, Render, Telegram and Upstash token prefixes, `VERCEL_OIDC_TOKEN` and the testnet mnemonic. The only private-key match is a `0x000…` placeholder. Only `.env.example` files are tracked.
- **Production secrets:** all in Vercel, marked sensitive: bot token, webhook secret, cron secret, KV tokens, Gemini keys.
- **Telegram webhook:** requires the secret header. Production returns 200 with the correct secret and 401 without it; the comparison is constant-time.
- **Daily cron:** requires `Authorization: Bearer CRON_SECRET`. Production returns 401 without it.
- **Telegram links:** 24-hex random tokens, single chat, expire after 48 h. Pending subscriptions expire and the cron prunes them.
- **Abuse limits:** subscribe 10 per hour per IP, 5 alerts per chat or email, Scan API 60 per hour per IP, ask 30 per hour, attest 5 per hour.
- **Alert actions need the secret token:** unsubscribe and check both require the subscription's token; an id alone is not enough.
- **Bot messages:** plain text (no `parse_mode`), so a label can't inject markup or links. Buttons accept only https URLs. The bot declines group chats.
- **Code injection:** no `dangerouslySetInnerHTML`, `eval`, `new Function` or `innerHTML` assignments in app code.
- **Widget messages:** `widget.js` accepts messages only from the Shor's Reach origin with `source: "shors-reach"`.
- **Seed phrases:** refused before any processing on scan, advise, ask and alerts. The AI only ever receives the anonymised summary, and identifiers in questions are refused.
- **Server logs:** only subscription ids, timings and token counts. No addresses, emails or chat ids.
- **Existing headers:** `Referrer-Policy: no-referrer`, `nosniff` and a restrictive `Permissions-Policy`.
- **Bundle:** entry 25 kB gzip; the wallet stack (~310 kB) loads only on "Connect Wallet".

## Accepted risks and follow-ups

1. **Production dependency advisories (29: 16 high, 13 moderate).**
   - **Where they come from:** all are in the wallet stack (`wagmi`, `viem`, `@walletconnect/*`, `@reown/*`, `@metamask/sdk`). npm offers no fix compatible with the QoreChain RainbowKit fork.
   - **Why exposure is low:**
     - The `ws` advisories affect Node WebSocket servers, while the browser uses its native WebSocket.
     - `decode-uri-component` and `uuid` are not reachable with attacker input here.
     - The zod advisory is mitigated server-side by finding 2.
   - **Follow-up:** move to zod 4, and update the wallet stack when the fork does.
2. **Rate limits are per server instance** (in memory, best effort). Upstash is now available, so a shared limiter is a small change if abuse appears.
3. **Daily check batch is 20 subscriptions per run** (300 s function limit). Beyond 20 active alerts, some are checked every second day. Fix by fanning out, or by running the cron several times a day.
4. **No full Content-Security-Policy.** The wallet stack, fonts and chain APIs need many origins. Ship a `Content-Security-Policy-Report-Only` first, then enforce.
5. **Upstream error text in cron logs.** A data source's error message could include the URL it called, which contains the watched address. Low; logs are private to the Vercel project.
6. **Widget `postMessage(…, "*")`.** It sends the public scan result of an input the host page itself supplied. Acceptable by design; the host verifies the origin.
7. **Credentials pasted in chat during setup must be rotated:**
   - Telegram bot token (BotFather `/revoke`).
   - Upstash token (Storage → Settings).
   - Gemini and Render keys.

## How to re-run

```bash
cd app
npm test                                   # 181 unit tests
npm audit --omit=dev                       # dependency advisories
npx tsx scripts/workflows.ts <url>         # 35 user-workflow steps
curl -sI https://shors-reach.vercel.app/   # headers
```
