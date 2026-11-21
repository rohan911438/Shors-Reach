/**
 * Advisor I/O contracts. The request is the anonymised scan summary (see scan/score/summary.ts);
 * anything else — or anything that looks like an address, txid or xpub — is rejected.
 */
import { z } from "zod";

import { containsIdentifier } from "../scan/score/summary.js";
import { STATUSES } from "../scan/types.js";
import { REASONS } from "../scan/score/reasons.js";

const STATUS = z.enum(STATUSES as unknown as [string, ...string[]]);
const REASON = z.enum(Object.keys(REASONS) as [string, ...string[]]);
const CHAIN = z.enum(["bitcoin", "ethereum", "base", "arbitrum", "optimism", "polygon", "bnb", "avalanche", "qorechain-evm", "qorechain"]);
const FORMAT = z.enum([
  "p2pk",
  "p2pkh",
  "p2sh-p2wpkh",
  "p2sh",
  "p2wpkh",
  "p2wsh",
  "p2tr",
  "eoa",
  "eip7702",
  "safe",
  "contract",
  "qore-native",
  "qore-evm-window",
]);
const usd = z.number().finite().min(0).max(1e13);

export const SummarySchema = z
  .object({
    score: z.number().int().min(0).max(100),
    scoreBasis: z.enum(["usd", "count"]),
    totalsUsdRounded: z.object({ EXPOSED_NOW: usd, EXPOSED_ON_SPEND: usd, PROTECTED: usd, UNKNOWN: usd }).strict(),
    holdings: z
      .array(z.object({ chain: CHAIN, format: FORMAT, status: STATUS, reason: REASON, usdRounded: usd.nullable() }).strict())
      .max(50),
    questionnaire: z.object({ signedMessages: z.enum(["yes", "no", "unsure"]), custodial: z.boolean() }).strict(),
    qorechain: z.object({ pqKeyRegistered: z.boolean(), windowLive: z.boolean() }).strict().nullable(),
  })
  .strict();

export type Summary = z.infer<typeof SummarySchema>;

export const PlanSchema = z
  .object({
    summary: z.string().min(1).max(600),
    actions: z
      .array(
        z
          .object({
            priority: z.number().int().min(1).max(10),
            title: z.string().min(1).max(120),
            why: z.string().min(1).max(500),
            how: z.string().min(1).max(700),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    stopDoing: z.array(z.string().min(1).max(300)).max(5),
    unknowns: z.array(z.string().min(1).max(300)).max(5),
    qorechainNote: z.string().min(1).max(500),
  })
  .strict();

export type Plan = z.infer<typeof PlanSchema>;

export interface AdviceResponse {
  plan: Plan;
  source: "ai" | "fallback";
  model?: string;
  /** Why the fallback was used (no key, API error, invalid output…). Never contains payload data. */
  fallbackReason?: string;
}

/** JSON Schema handed to the Messages API structured-output format (mirrors PlanSchema). */
export const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "actions", "stopDoing", "unknowns", "qorechainNote"],
  properties: {
    summary: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "title", "why", "how"],
        properties: {
          priority: { type: "integer" },
          title: { type: "string" },
          why: { type: "string" },
          how: { type: "string" },
        },
      },
    },
    stopDoing: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    qorechainNote: { type: "string" },
  },
} as const;

export type ParseResult = { ok: true; summary: Summary } | { ok: false; error: string };

/** Validate an untrusted request body. Rejects identifiers before schema checks so the error never echoes them. */
export function parseSummary(raw: unknown): ParseResult {
  let text: string;
  try {
    text = typeof raw === "string" ? raw : JSON.stringify(raw);
  } catch {
    return { ok: false, error: "Body is not JSON." };
  }
  if (text.length > 20_000) return { ok: false, error: "Body too large." };
  if (containsIdentifier(text)) return { ok: false, error: "Body contains an address, transaction id or key. Only the anonymised summary is accepted." };
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Body is not JSON." };
    }
  }
  const r = SummarySchema.safeParse(value);
  if (!r.success) return { ok: false, error: `Invalid summary: ${r.error.issues[0]?.path.join(".") || "root"} ${r.error.issues[0]?.message ?? ""}`.trim() };
  return { ok: true, summary: r.data };
}
