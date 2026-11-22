import { useState, type FormEvent } from "react";

import { navigate } from "../lib/router.js";
import { detectInput } from "../scan/index.js";

export const EXAMPLES: { label: string; input: string; hint: string }[] = [
  {
    label: "Satoshi's genesis key",
    input:
      "04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f",
    hint: "The block-0 public key — finds coins with no address at all",
  },
  { label: "vitalik.eth", input: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", hint: "One key, eight chains" },
  { label: "A Taproot address", input: "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297", hint: "The newest format — public key in every output" },
  { label: "An exchange cold wallet", input: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", hint: "Reused multisig" },
];

const KIND_LABEL: Record<string, string> = {
  "btc-address": "Bitcoin address",
  "btc-pubkey": "Bitcoin public key",
  "btc-xpub": "HD wallet (xpub)",
  "evm-address": "EVM address",
  "qore-address": "QoreChain address",
};

export function ScanInput({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  let kind: string | null = null;
  try {
    kind = value.trim() ? KIND_LABEL[detectInput(value)] ?? null : null;
  } catch {
    kind = null;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    try {
      detectInput(v);
      setError(null);
      navigate({ name: "scan", input: v });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={compact ? "compact" : undefined}>
      <form className="scanbox" onSubmit={submit} role="search">
        <label htmlFor="scan-input" className="sr-only">
          Bitcoin address, public key, xpub, 0x or qor1 address
        </label>
        <input
          id="scan-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste a Bitcoin address, xpub, public key, 0x… or qor1…"
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn primary" type="submit">
          Scan exposure
        </button>
      </form>
      <div className="faint" style={{ fontSize: 13, marginTop: 8, minHeight: 20, textAlign: compact ? "left" : "center" }}>
        {kind ? `Detected: ${kind}` : "Public data only. Never paste a seed phrase or private key."}
      </div>
      {error && (
        <div className="input-error" role="alert">
          {error}
        </div>
      )}
      {!compact && (
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} className="chip" type="button" title={ex.hint} onClick={() => navigate({ name: "scan", input: ex.input })}>
              Try: {ex.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
