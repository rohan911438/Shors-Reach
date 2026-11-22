import "./styles.css";
import "./theme.css";

import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { ScanProvider } from "./lib/scanStore.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <React.StrictMode>
    <ScanProvider>
      <App />
    </ScanProvider>
  </React.StrictMode>,
);
