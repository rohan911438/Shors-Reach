/**
 * POST /api/v1/scan — public Scan API (see src/api/scanApi.ts and #/developers).
 * Optional env: SCAN_API_KEYS (comma separated partner keys with a higher rate limit), PUBLIC_URL.
 */
import { handleScanApi } from "../../src/api/scanApi.js";

const keys = (process.env.SCAN_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);

async function handle(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const origin = process.env.PUBLIC_URL ?? `https://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost"}`;
  return handleScanApi(request, { origin, apiKeys: keys, log: (m) => console.log(m) }, ip);
}

export const POST = handle;
export const OPTIONS = handle;
export const GET = handle;
