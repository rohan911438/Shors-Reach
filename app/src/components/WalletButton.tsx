import { lazy, Suspense, useState } from "react";

const load = () => import("./WalletIsland.js");
const WalletIsland = lazy(load);

/** Placeholder that prefetches the wallet island on hover/focus and mounts it (modal open) on click. */
export function WalletButton() {
  const [open, setOpen] = useState(false);
  const placeholder = (
    <button
      type="button"
      className="btn primary small wallet-ph"
      onPointerEnter={() => void load()}
      onFocus={() => void load()}
      onClick={() => setOpen(true)}
      aria-busy={open}
    >
      Connect Wallet
    </button>
  );
  if (!open) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <WalletIsland openOnLoad />
    </Suspense>
  );
}
