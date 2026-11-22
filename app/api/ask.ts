/**
 * POST /api/ask — follow-up questions on a plan. Receives ONLY { summary, plan?, question, history? };
 * questions containing addresses/txids/keys or seed phrases are refused before any model call.
 */
import { handleAsk } from "../src/advisor/ask.js";
import { parseKeys } from "../src/advisor/server.js";

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  return handleAsk(
    request,
    { apiKeys: parseKeys(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY), model: process.env.ADVISOR_MODEL, log: (m) => console.log(m) },
    ip,
  );
}
