/**
 * Reads a request body with a hard size cap, before any JSON/zod parsing.
 * Why: the platform accepts multi-MB bodies, and validating huge collections can exhaust memory
 * (zod advisory GHSA for oversized constrained collections). Every endpoint's real payload is a few KB.
 * Returns null when the body is larger than `maxBytes` (checked on Content-Length and while streaming).
 */
export const BODY_TOO_LARGE = { error: "Request body too large.", code: "too-large" } as const;

export async function readCapped(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
