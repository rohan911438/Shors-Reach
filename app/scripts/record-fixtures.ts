/**
 * Record real API responses for offline unit tests:  npx tsx scripts/record-fixtures.ts
 * Writes src/scan/__fixtures__/<name>.json  (map of request key → response).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { scan } from "../src/scan/index.js";
import { fetchTransport, requestKey, type NetResponse, type Transport } from "../src/scan/net.js";

const CASES: Record<string, string> = {
  "genesis-pubkey": "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f",
  "satoshi-address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "taproot": "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297",
  "multisig-reused": "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",
  "vitalik": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "qore-registered": "0x707B92f6276799f928CCe4D5873f5A2babF85347",
};

const dir = join(import.meta.dirname, "..", "src", "scan", "__fixtures__");
mkdirSync(dir, { recursive: true });

for (const [name, input] of Object.entries(CASES)) {
  const recorded: Record<string, NetResponse> = {};
  const recorder: Transport = async (req, signal) => {
    const res = await fetchTransport(req, signal);
    recorded[requestKey(req)] = res;
    return res;
  };
  const r = await scan(input, { transport: recorder });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(recorded, null, 1));
  console.log(`${name}: ${Object.keys(recorded).length} responses, ${r.holdings.length} holdings, score ${r.score}`);
}
