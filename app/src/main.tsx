import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";
import "./theme.css";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";

import { App } from "./App.js";
import { ScanProvider } from "./lib/scanStore.js";
import { config } from "./wagmi.js";

const queryClient = new QueryClient();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#c8ff3d", accentColorForeground: "#0a0a08", borderRadius: "large", fontStack: "system" })}>
          <ScanProvider>
            <App />
          </ScanProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
