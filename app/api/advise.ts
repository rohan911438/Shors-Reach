/**
 * POST /api/advise — Vercel Node function. Receives ONLY the anonymised scan summary; returns a plan.
 * Secrets: ANTHROPIC_API_KEY. Optional: ADVISOR_MODEL (default claude-opus-5-5).
 * Logs token counts only — never payloads.
 */
import { handleAdvise } from "../src/advisor/server.js";

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  return handleAdvise(
    request,
    { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ADVISOR_MODEL, log: (m) => console.log(m) },
    ip,
  );
}
