import type { ChainId } from "../types.js";

export interface EvmChain {
  id: ChainId;
  name: string;
  chainId: number;
  rpc: string;
  symbol: string;
  priceId: string;
  explorer: string; // address page prefix
}

/** Public, CORS-enabled RPCs (publicnode). The same secp256k1 key controls an address on all of them. */
export const EVM_CHAINS: EvmChain[] = [
  { id: "ethereum", name: "Ethereum", chainId: 1, rpc: "https://ethereum-rpc.publicnode.com", symbol: "ETH", priceId: "ethereum", explorer: "https://etherscan.io/address/" },
  { id: "base", name: "Base", chainId: 8453, rpc: "https://base-rpc.publicnode.com", symbol: "ETH", priceId: "ethereum", explorer: "https://basescan.org/address/" },
  { id: "arbitrum", name: "Arbitrum One", chainId: 42161, rpc: "https://arbitrum-one-rpc.publicnode.com", symbol: "ETH", priceId: "ethereum", explorer: "https://arbiscan.io/address/" },
  { id: "optimism", name: "OP Mainnet", chainId: 10, rpc: "https://optimism-rpc.publicnode.com", symbol: "ETH", priceId: "ethereum", explorer: "https://optimistic.etherscan.io/address/" },
  { id: "polygon", name: "Polygon", chainId: 137, rpc: "https://polygon-bor-rpc.publicnode.com", symbol: "POL", priceId: "polygon-ecosystem-token", explorer: "https://polygonscan.com/address/" },
  { id: "bnb", name: "BNB Smart Chain", chainId: 56, rpc: "https://bsc-rpc.publicnode.com", symbol: "BNB", priceId: "binancecoin", explorer: "https://bscscan.com/address/" },
  { id: "avalanche", name: "Avalanche C-Chain", chainId: 43114, rpc: "https://avalanche-c-chain-rpc.publicnode.com", symbol: "AVAX", priceId: "avalanche-2", explorer: "https://snowtrace.io/address/" },
];
