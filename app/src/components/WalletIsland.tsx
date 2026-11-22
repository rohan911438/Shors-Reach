/**
 * The wallet stack (wagmi + RainbowKit + QoreX connector, ~2 MB) as a lazily loaded island.
 * Nothing else in the app needs it: counters use a plain viem client and the Pass flow talks to QoreX directly.
 */
import "@rainbow-me/rainbowkit/styles.css";

import { ConnectButton, darkTheme, RainbowKitProvider, useConnectModal } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAccount, WagmiProvider } from "wagmi";

import { config } from "../wagmi.js";

const queryClient = new QueryClient();

/** Opens the modal for the click that loaded the island — once wagmi has settled (RainbowKit closes modals on status changes). */
function AutoOpen({ open }: { open: boolean }) {
  const { openConnectModal } = useConnectModal();
  const { status } = useAccount();
  const done = useRef(false);
  useEffect(() => {
    if (!open || done.current || status !== "disconnected" || !openConnectModal) return;
    const t = setTimeout(() => {
      done.current = true;
      openConnectModal();
    }, 50);
    return () => clearTimeout(t);
  }, [open, status, openConnectModal]);
  return null;
}

export default function WalletIsland({ openOnLoad }: { openOnLoad: boolean }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#c8ff3d", accentColorForeground: "#0a0a08", borderRadius: "large", fontStack: "system" })}>
          <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} />
          <AutoOpen open={openOnLoad} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
