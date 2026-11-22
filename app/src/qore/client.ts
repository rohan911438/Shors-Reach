/**
 * Read-only viem client for QoreChain testnet. Used for public counters and the dashboard so the
 * landing page doesn't need the wallet stack (RainbowKit/wagmi load lazily, only for the Connect button).
 */
import { createPublicClient, defineChain, http } from "viem";

export const qoreTestnet = defineChain({
  id: 9800,
  name: "QoreChain Testnet",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } },
});

export const qoreClient = createPublicClient({ chain: qoreTestnet, transport: http(undefined, { batch: true }) });
