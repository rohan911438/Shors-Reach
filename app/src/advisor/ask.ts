/**
 * Follow-up Q&A on a plan. Input = the same anonymised summary the plan used + (optionally) the plan + a question.
 * The question itself is checked: anything that looks like an address, txid, xpub or seed phrase is refused
 * before it reaches a model. Output goes through the same guards as the plan (no identifiers, never asks for secrets).
 */
import { z } from "zod";

import { looksLikeSeedPhrase } from "../lib/seed.js";
import { containsIdentifier } from "../scan/score/summary.js";
import { PlanSchema, SummarySchema, type Summary } from "./schema.js";
import {
  asksForSecrets,
  DEFAULT_MODEL,
  geminiClient,
  type AdvisorEnv,
  type GenerateClient,
  UpstreamError,
} from "./server.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { BODY_TOO_LARGE, readCapped } from "../lib/http.js";

export const AskRequestSchema = z
  .object({
    summary: SummarySchema,
    plan: PlanSchema.nullable().optional(),
    question: z.string().trim().min(2).max(400),
    history: z
      .array(z.object({ q: z.string().max(400), a: z.string().max(1500) }).strict())
      .max(6)
      .optional(),
  })
  .strict();
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AnswerSchema = z
  .object({
    answer: z.string().min(1).max(1500),
    followUps: z.array(z.string().min(1).max(120)).max(3),
  })
  .strict();
export type Answer = z.infer<typeof AnswerSchema>;

export interface AskResponse extends Answer {
  source: "ai" | "fallback";
  model?: string;
  fallbackReason?: string;
}

export const ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "Plain-language answer, 1–5 short paragraphs, max ~1200 characters." },
    followUps: { type: "array", items: { type: "string" }, maxItems: 3, description: "Up to 3 short follow-up questions." },
  },
  required: ["answer", "followUps"],
};

export const ASK_SYSTEM_PROMPT = `You answer follow-up questions inside Shor's Reach, a tool that shows which crypto holdings sit behind public keys a future quantum computer could attack.

You get: the user's anonymised scan summary (chains, formats, verdicts, reason codes, USD rounded), the plan they were given, earlier Q&A, and a new question.

Rules:
- Answer only questions about quantum exposure, the user's scan, the plan, wallets, key hygiene, address formats, migration steps and QoreChain's post-quantum features. For anything else (prices, which token to buy, unrelated topics), say briefly that you can only help with quantum exposure and their plan.
- Ground every statement in the summary or in well-established facts. Do not invent holdings, amounts or chains. Refer to holdings by chain and format, never by identifiers.
- Never ask for, or tell the user to enter, a seed phrase, private key or recovery phrase. Mention them only to say never to share them.
- Not financial advice: never recommend buying, selling or holding a token. Do not predict when quantum computers arrive; say estimates vary widely.
- Hardware wallets (Ledger, Trezor, Coldcard…): explain generic steps — create a fresh receive address in the wallet app, check it on the device screen, send a small test first, avoid reusing addresses. Do not claim vendor features you are not sure about.
- Bitcoin: Taproot (p2tr) exposes the key at rest; P2PK exposes it always; spending from an address reveals its key; native SegWit (bc1q) hides it until spent. BIP-360 is a draft.
- EVM: one sent transaction exposes the key on every EVM chain.
- QoreChain: native txs require a hybrid secp256k1 + ML-DSA-87 signature; registering the post-quantum key early matters.
- Plain words, short sentences, no hype, no emojis, no markdown headings. Keep it under ~1200 characters.
- followUps: up to 3 short, useful next questions the user might ask.`;

export function askMessage(r: AskRequest): string {
  const hist = (r.history ?? []).map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n\n");
  return `Scan summary (anonymised JSON):
${JSON.stringify(r.summary)}

${r.plan ? `Plan they were given (JSON):\n${JSON.stringify(r.plan)}\n\n` : ""}${hist ? `Earlier Q&A:\n${hist}\n\n` : ""}New question: ${r.question}`;
}

// ---------------------------------------------------------------- rule-based fallback

interface Topic {
  match: RegExp;
  answer: (s: Summary) => string;
  followUps: string[];
}

const has = (s: Summary, f: (h: Summary["holdings"][number]) => boolean) => s.holdings.some(f);

export const TOPICS: Topic[] = [
  {
    match: /taproot|p2tr|bc1p/i,
    answer: (s) =>
      `Taproot (bc1p…) outputs put the public key itself on-chain, so they count as exposed from the moment they receive coins — spent or not.${has(s, (h) => h.format === "p2tr") ? " Your scan includes Taproot holdings, which is why they are red." : ""} For long-term storage, a fresh native SegWit (bc1q…) address keeps the key hidden until you spend. A post-quantum output type (BIP-360) is still a draft.`,
    followUps: ["How do I move coins to a fresh address?", "Is native SegWit quantum-safe forever?"],
  },
  {
    match: /ledger|trezor|coldcard|hardware|keystone|bitbox/i,
    answer: () =>
      "With a hardware wallet: open its companion app, create a new receive address you have never used, and check it on the device screen. Send a small test amount first, then the rest. Do not send back to an old address, and avoid reusing the new one. The device never needs your recovery phrase typed anywhere — never enter it into a website or app.",
    followUps: ["Why does reusing an address matter?", "Should I move everything at once?"],
  },
  {
    match: /reus|same address|spent from|spend reveal|why.*red|exposed now/i,
    answer: (s) =>
      `Bitcoin addresses of the common types hide the public key behind a hash until you spend. The first spend writes the key on-chain, and any coins still on that address — or sent to it later — stay behind a public key.${has(s, (h) => h.reason === "btc-sibling-key-revealed") ? " Your scan also found the same key behind other address formats, which is why those are red too." : ""} The fix is to move to a fresh, never-used address and stop reusing addresses.`,
    followUps: ["What does 'exposed on spend' mean?", "How do I move coins to a fresh address?"],
  },
  {
    match: /on spend|amber|short exposure|pending|mempool/i,
    answer: () =>
      "Exposed on spend means the public key is still hidden behind a hash. It becomes visible only while a transaction spending those coins waits to confirm — minutes, not years. That is a much smaller window than keys that are already public, so those come first in your plan.",
    followUps: ["Why are some of my holdings red?", "What is the safest address type today?"],
  },
  {
    match: /p2pk|satoshi|genesis|no address/i,
    answer: () =>
      "P2PK is the oldest output type: the public key itself is the locking script, with no hash in front. Those coins have been exposed since the day they were received. That is why a public key can find coins that have no address at all.",
    followUps: ["Why are Taproot addresses red?", "What should I move first?"],
  },
  {
    match: /ethereum|evm|metamask|nonce|base|arbitrum|polygon|optimism|bnb|avalanche/i,
    answer: (s) =>
      `On EVM chains the account's public key can be recovered from any transaction it has signed. One sent transaction exposes the key on every EVM chain, because the same key controls the same address everywhere.${has(s, (h) => h.chain !== "bitcoin" && h.status === "EXPOSED_NOW") ? " That is why your account shows red across several chains." : ""} A fresh account stays hidden only until its first transaction; smart-account and post-quantum account options are emerging.`,
    followUps: ["Does a fresh account fix it for good?", "What about signed messages?"],
  },
  {
    match: /qore|ml-?dsa|post-?quantum key|register|pass\b/i,
    answer: () =>
      "QoreChain requires a hybrid signature — classical secp256k1 plus ML-DSA-87 — for native transactions. The first registration of your post-quantum key needs only a classical signature, so registering early matters. The Quantum Pass records that on-chain, verified by QoreChain's precompiles.",
    followUps: ["How do I get a Quantum Pass?", "Does this protect my Bitcoin?"],
  },
  {
    match: /when|how long|timeline|q-?day|years/i,
    answer: () =>
      "Nobody knows when a quantum computer will break elliptic-curve keys — expert estimates vary widely. The practical point: keys that are already public can be attacked whenever that day comes, with no warning, so moving those first costs little and removes the biggest risk.",
    followUps: ["What should I move first?", "Why are some of my holdings red?"],
  },
  {
    match: /first|priority|start|order|what (do|should) i do/i,
    answer: (s) =>
      s.totalsUsdRounded.EXPOSED_NOW > 0
        ? "Start with the red rows that hold the most value: their keys are already public. Move them to fresh, never-used addresses, test with a small amount first, then deal with the amber (exposed on spend) holdings and your QoreChain key."
        : "Nothing in your scan is exposed right now. Keep it that way: avoid reusing addresses, prefer native SegWit for long-term Bitcoin storage, and register a post-quantum key on QoreChain.",
    followUps: ["How do I move coins to a fresh address?", "Why does reusing an address matter?"],
  },
  {
    match: /fresh address|move (coins|funds)|migrat|new wallet|how do i move/i,
    answer: () =>
      "In your wallet, generate a new receive address you have never received to or spent from. Send a small test amount, confirm it arrived, then send the rest. Prefer native SegWit (bc1q…) for Bitcoin. Never type your recovery phrase into any website.",
    followUps: ["Should I move everything at once?", "Why are Taproot addresses red?"],
  },
];

const OFF_TOPIC = /\b(price|buy|sell|pump|moon|invest|profit|which (coin|token)|financial advice)\b/i;

export function fallbackAnswer(r: AskRequest): Answer {
  if (OFF_TOPIC.test(r.question))
    return {
      answer:
        "I can only help with quantum exposure — your scan, your plan, wallets, address hygiene and QoreChain's post-quantum features. I can't give price or investment advice.",
      followUps: ["What should I move first?", "Why are some of my holdings red?"],
    };
  const t = TOPICS.find((x) => x.match.test(r.question));
  if (t) return { answer: t.answer(r.summary), followUps: t.followUps };
  return {
    answer:
      "I can answer questions about your scan and plan: why a holding is red or amber, how to move to a fresh address, hardware wallets, Taproot, EVM accounts and QoreChain's post-quantum key. Try one of the suggestions below.",
    followUps: ["Why are some of my holdings red?", "What do I do with a Ledger?", "What should I move first?"],
  };
}

// ---------------------------------------------------------------- AI path

export async function ask(r: AskRequest, env: AdvisorEnv): Promise<AskResponse> {
  const log = env.log ?? (() => {});
  const model = env.model || DEFAULT_MODEL;
  const keys = env.apiKeys ?? [];
  const fb = (reason: string): AskResponse => ({ ...fallbackAnswer(r), source: "fallback", fallbackReason: reason });
  if (!env.client && keys.length === 0) return fb("no-api-key");
  const client: GenerateClient = env.client ?? geminiClient(keys, { timeoutMs: 12_000, budgetMs: 45_000, fallbackModels: env.fallbackModels });
  let last = "unknown";
  for (let i = 0; i < 2; i++) {
    try {
      const out = await client.generate({ model, system: ASK_SYSTEM_PROMPT, user: askMessage(r), schema: ANSWER_JSON_SCHEMA, maxOutputTokens: 3000 });
      log(`ask model=${out.model ?? model} tokens in=${out.usage?.in} out=${out.usage?.out} finish=${out.finishReason}`);
      if (out.finishReason !== "STOP") {
        last = out.finishReason === "MAX_TOKENS" ? "truncated" : "refusal";
        if (last === "refusal") break;
        continue;
      }
      const parsed = AnswerSchema.safeParse(JSON.parse(out.text));
      if (!parsed.success) {
        last = "invalid-answer";
        continue;
      }
      const txt = JSON.stringify(parsed.data);
      if (containsIdentifier(txt) || asksForSecrets(txt)) {
        last = "unsafe-output";
        continue;
      }
      return { ...parsed.data, source: "ai", model: out.model ?? model };
    } catch (err) {
      if (err instanceof UpstreamError) {
        last = `api-${err.status || "error"}`;
        if ([400, 401, 403, 404, 429].includes(err.status)) break;
      } else last = err instanceof SyntaxError ? "invalid-json" : "network";
    }
  }
  return fb(last);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const limiter = createRateLimiter(30);
export function resetAskRateLimit() {
  limiter.reset();
}

export const IDENTIFIER_REFUSAL =
  "Please ask without pasting addresses, transaction IDs or keys — the advisor only ever sees your anonymised summary. Describe the holding instead (e.g. “my Taproot address”).";
export const SEED_REFUSAL =
  "That looks like a seed phrase. Never paste it anywhere — not here, not into any website. If you've shared it before, move your funds to a new wallet.";

export async function handleAsk(req: Request, env: AdvisorEnv, ip = "unknown"): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (limiter.limited(ip, Date.now(), env.rateLimit ?? 30)) return json(429, { error: "Too many questions — try again in an hour." });
  let raw: unknown;
  try {
    const text = await readCapped(req, 49_152);
    if (text === null) return json(413, BODY_TOO_LARGE);
    raw = JSON.parse(text);
  } catch {
    return json(400, { error: "Send JSON." });
  }
  const q = (raw as { question?: unknown })?.question;
  if (typeof q === "string" && looksLikeSeedPhrase(q)) return json(400, { error: SEED_REFUSAL, code: "seed-phrase" });
  if (typeof q === "string" && containsIdentifier(q)) return json(400, { error: IDENTIFIER_REFUSAL, code: "identifier" });
  const parsed = AskRequestSchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request: send { summary, plan?, question, history? }." });
  // The history is model output we sent earlier, but the client could tamper with it.
  if ((parsed.data.history ?? []).some((h) => containsIdentifier(h.q) || containsIdentifier(h.a)))
    return json(400, { error: IDENTIFIER_REFUSAL, code: "identifier" });
  return json(200, await ask(parsed.data, env));
}
