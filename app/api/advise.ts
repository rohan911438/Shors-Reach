/**
 * POST /api/advise — Vercel Node function. Receives ONLY the anonymised scan summary; returns a plan.
 * Secrets: GEMINI_API_KEYS (comma separated, rotated on 401/403/429) or GEMINI_API_KEY.
 * Optional: ADVISOR_MODEL (default gemini-3.5-flash). Logs token counts only — never payloads.
 */
import { handleAdvise, parseKeys } from "../src/advisor/server.js";

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  return handleAdvise(
    request,
    {
      apiKeys: parseKeys(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY),
      model: process.env.ADVISOR_MODEL,
      log: (m) => console.log(m),
    },
    ip,
  );
}
