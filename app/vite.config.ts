import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// The public REST APIs send no CORS headers, so the browser reaches them
// through the dev (and preview) server: /lcd-testnet and /lcd-mainnet are
// forwarded to each network's REST endpoint. In production a Vercel rewrite does the same.
const rest = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/lcd-(testnet|mainnet)/, ""),
});
const proxy = {
  "/lcd-testnet": rest("https://api-testnet.qore.host"),
  "/lcd-mainnet": rest("https://api.qore.host"),
};

/** Serves api/advise.ts during `vite dev`, so the advisor works locally without `vercel dev`. */
function apiDev(env: Record<string, string>): Plugin {
  return {
    name: "shors-reach-api-dev",
    configureServer(server) {
      server.middlewares.use("/api/advise", async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const mod = (await server.ssrLoadModule("/src/advisor/server.ts")) as typeof import("./src/advisor/server");
          const request = new Request("http://localhost/api/advise", {
            method: req.method,
            headers: { "content-type": "application/json" },
            body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
          });
          const out = await mod.handleAdvise(
            request,
            { apiKeys: mod.parseKeys(env.GEMINI_API_KEYS, env.GEMINI_API_KEY), model: env.ADVISOR_MODEL, rateLimit: 100, log: (m) => server.config.logger.info(m) },
            req.socket.remoteAddress ?? "local",
          );
          res.statusCode = out.status;
          res.setHeader("content-type", "application/json");
          res.end(await out.text());
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      server.middlewares.use("/api/ask", async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const srv = (await server.ssrLoadModule("/src/advisor/server.ts")) as typeof import("./src/advisor/server");
          const mod = (await server.ssrLoadModule("/src/advisor/ask.ts")) as typeof import("./src/advisor/ask");
          const out = await mod.handleAsk(
            new Request("http://localhost/api/ask", { method: req.method, body: req.method === "POST" ? Buffer.concat(chunks) : undefined }),
            { apiKeys: srv.parseKeys(env.GEMINI_API_KEYS, env.GEMINI_API_KEY), model: env.ADVISOR_MODEL, rateLimit: 200 },
            req.socket.remoteAddress ?? "local",
          );
          res.statusCode = out.status;
          res.setHeader("content-type", "application/json");
          res.end(await out.text());
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      // Attester (needs QORE_ATTESTER_MNEMONIC in app/.env — gitignored, testnet only).
      server.middlewares.use("/api/attest", async (req, res) => {
        try {
          if (env.QORE_ATTESTER_MNEMONIC) process.env.QORE_ATTESTER_MNEMONIC = env.QORE_ATTESTER_MNEMONIC;
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const mod = (await server.ssrLoadModule("/server/attest.ts")) as { POST: (r: Request) => Promise<Response> };
          const out = await mod.POST(new Request("http://localhost/api/attest", { method: "POST", body: Buffer.concat(chunks) }));
          res.statusCode = out.status;
          res.setHeader("content-type", "application/json");
          res.end(await out.text());
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), apiDev(env)],
    server: { port: 5173, proxy },
    preview: { proxy },
    build: {
      rollupOptions: {
        output: {
          // Long-lived vendor chunks: wallet stack and crypto libs change rarely.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (/viem|@noble|@scure|abitype|[\\/]ox[\\/]/.test(id)) return "crypto";
            if (/@cosmjs|cosmjs-types|@qorechain|protobufjs|[\\/]long[\\/]/.test(id)) return "cosmos";
            if (/react-dom|[\\/]react[\\/]|scheduler/.test(id)) return "react";
          },
        },
      },
    },
  };
});
