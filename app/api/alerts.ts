/**
 * /api/alerts — opt-in email / Telegram alerts for watched addresses (see src/alerts/handler.ts).
 * Needs storage (Upstash Redis via Vercel Marketplace: KV_REST_API_URL + KV_REST_API_TOKEN) and at least one channel:
 *   email:    RESEND_API_KEY, ALERTS_FROM
 *   telegram: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET
 * Cron (vercel.json) calls ?action=cron with Authorization: Bearer CRON_SECRET.
 * Without these the endpoint reports itself disabled and the UI hides the option.
 */
import { handleAlerts } from "../src/alerts/handler.js";
import { kvFromEnv } from "../src/alerts/kv.js";
import { channelsFromEnv } from "../src/alerts/notify.js";
import { scan } from "../src/scan/index.js";

const kv = kvFromEnv(process.env);
const { mailer, telegram } = channelsFromEnv(process.env);

async function handle(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const origin = process.env.PUBLIC_URL ?? `https://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost"}`;
  return handleAlerts(
    request,
    {
      kv,
      mailer,
      telegram,
      scanner: (input) => scan(input, { signal: AbortSignal.timeout(40_000) }),
      origin,
      cronSecret: process.env.CRON_SECRET,
      telegramSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
      batch: 20,
      log: (m) => console.log(m),
    },
    ip,
  );
}

export const GET = handle;
export const POST = handle;
