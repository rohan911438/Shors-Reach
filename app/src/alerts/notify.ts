/**
 * Delivery channels for opt-in alerts. Both are optional and env-gated:
 *   Email    — Resend REST API (RESEND_API_KEY, ALERTS_FROM e.g. "Shor's Reach <alerts@yourdomain>")
 *   Telegram — Bot API (TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET)
 */
export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}
export interface TgButton {
  text: string;
  url: string;
}
export interface Telegram {
  username: string;
  /** buttons: one URL button per row (Telegram only accepts https URLs). */
  send(chatId: string, text: string, buttons?: TgButton[]): Promise<void>;
}

export function resendMailer(apiKey: string, from: string, fetchFn: typeof fetch = fetch): Mailer {
  return {
    async send(to, subject, text) {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`email failed: ${res.status}`);
    },
  };
}

export function telegramBot(token: string, username: string, fetchFn: typeof fetch = fetch): Telegram {
  return {
    username,
    async send(chatId, text, buttons) {
      const safe = (buttons ?? []).filter((b) => b.url.startsWith("https://"));
      const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(safe.length ? { reply_markup: { inline_keyboard: safe.map((b) => [b]) } } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`telegram failed: ${res.status}`);
    },
  };
}

export function channelsFromEnv(env: Record<string, string | undefined>): { mailer: Mailer | null; telegram: Telegram | null } {
  return {
    mailer: env.RESEND_API_KEY && env.ALERTS_FROM ? resendMailer(env.RESEND_API_KEY, env.ALERTS_FROM) : null,
    telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME ? telegramBot(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_BOT_USERNAME) : null,
  };
}
