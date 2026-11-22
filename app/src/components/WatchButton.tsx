import { useState } from "react";

import { href } from "../lib/router.js";
import type { ScanResult } from "../scan/types.js";
import { addToWatchlist, useWatchlist } from "../watch/store.js";

/** "Watch" on a scan result: saves it on this device, using this scan as the baseline. */
export function WatchButton({ result, disabled }: { result: ScanResult; disabled?: boolean }) {
  const list = useWatchlist();
  const [error, setError] = useState<string | null>(null);
  const watched = list.some((i) => i.input === result.input.trim());
  if (watched)
    return (
      <a className="btn" href={href({ name: "watch" })} title="Saved on this device">
        ✓ Watching
      </a>
    );
  return (
    <>
      <button
        className="btn"
        type="button"
        disabled={disabled}
        title="Save on this device and re-check on every visit"
        onClick={() => {
          const r = addToWatchlist(result.input, undefined, result);
          setError(r.ok ? null : r.error);
        }}
      >
        + Watch
      </button>
      {error && (
        <span className="input-error" role="alert" style={{ flexBasis: "100%" }}>
          {error}
        </span>
      )}
    </>
  );
}
