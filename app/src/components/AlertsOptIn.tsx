import { useEffect, useState, type FormEvent } from "react";

import type { WatchItem } from "../watch/store.js";

type Status = { storage: boolean; email: boolean; telegram: boolean };
type LinkAction = { action: "confirm" | "unsubscribe"; id: string; t: string };

/** Reads #/watch/confirm/<id>/<t> or #/watch/unsubscribe/<id>/<t> (tokens live in the fragment, never in server logs). */
export function parseAlertLink(hash: string): LinkAction | null {
  const m = /^#\/watch\/(confirm|unsubscribe)\/([0-9a-f]{8,64})\/([0-9a-f]{16,64})$/.exec(hash);
  return m ? { action: m[1] as LinkAction["action"], id: m[2]!, t: m[3]! } : null;
}

function LinkHandler() {
  const [link] = useState(() => parseAlertLink(window.location.hash));
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  useEffect(() => {
    if (!link) return;
    (async () => {
      try {
        const res = await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(link) });
        const body = (await res.json().catch(() => ({}))) as { error?: string; label?: string };
        if (!res.ok) return setMsg({ tone: "warn", text: body.error ?? "That link didn't work." });
        setMsg(
          link.action === "confirm"
            ? { tone: "ok", text: `Alerts are on for “${body.label ?? "your address"}”. We check daily and email you when something changes.` }
            : { tone: "ok", text: "Unsubscribed. The address and your email have been deleted from our server." },
        );
      } catch {
        setMsg({ tone: "warn", text: "Couldn't reach the server. Try the link again." });
      } finally {
        history.replaceState(null, "", "#/watch"); // drop the token from the address bar
      }
    })();
  }, [link]);
  if (!link) return null;
  return (
    <div className={`notice ${msg?.tone === "warn" ? "warn" : "info"}`} role="status" style={{ marginBottom: 18 }}>
      {msg ? msg.text : link.action === "confirm" ? "Confirming your alerts…" : "Unsubscribing…"}
    </div>
  );
}

export function AlertsOptIn({ items }: { items: WatchItem[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [itemId, setItemId] = useState("");
  const [channel, setChannel] = useState<"email" | "telegram">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "warn"; text: string; link?: string } | null>(null);

  useEffect(() => {
    fetch("/api/alerts?action=status")
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
      .then((s) => setStatus(s ?? { storage: false, email: false, telegram: false }))
      .catch(() => setStatus({ storage: false, email: false, telegram: false }));
  }, []);
  useEffect(() => {
    if (status && !status.email && status.telegram) setChannel("telegram");
  }, [status]);

  const enabled = !!status && (status.email || status.telegram);
  const selected = items.find((i) => i.id === (itemId || items[0]?.id));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "subscribe", input: selected.input, label: selected.label, channel, email: channel === "email" ? email : undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; link?: string };
      setResult(res.ok ? { tone: "ok", text: body.message ?? "Done.", link: body.link } : { tone: "warn", text: body.error ?? `Failed (${res.status}).` });
    } catch {
      setResult({ tone: "warn", text: "Couldn't reach the server." });
    }
    setBusy(false);
  };

  return (
    <>
      <LinkHandler />
      <section className="card w-alerts" style={{ marginTop: 20 }} aria-labelledby="alerts-title">
        <div className="eyebrow">Optional</div>
        <h3 id="alerts-title" style={{ marginTop: 4 }}>
          Alerts by email or Telegram
        </h3>
        <p className="muted" style={{ marginTop: 0 }}>
          The watchlist above never leaves this device, so it only checks while you visit. For alerts while you're away, our server has to store the
          address and where to reach you. That's opt-in, confirmed by you, checked once a day, and deleted the moment you unsubscribe.
        </p>

        {status === null ? (
          <div className="scanline" />
        ) : !enabled ? (
          <div className="notice info" role="status">
            Email and Telegram alerts aren't switched on for this deployment yet. The on-device watchlist works fully.
          </div>
        ) : items.length === 0 ? (
          <p className="faint">Watch an address first, then turn on alerts for it here.</p>
        ) : (
          <form onSubmit={submit} className="w-alerts-form">
            <label>
              <span className="faint">Entry</span>
              <select value={selected?.id} onChange={(e) => setItemId(e.target.value)}>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="faint">Channel</legend>
              {status.email && (
                <label className="radio">
                  <input type="radio" name="ch" checked={channel === "email"} onChange={() => setChannel("email")} /> Email
                </label>
              )}
              {status.telegram && (
                <label className="radio">
                  <input type="radio" name="ch" checked={channel === "telegram"} onChange={() => setChannel("telegram")} /> Telegram
                </label>
              )}
            </fieldset>
            {channel === "email" && (
              <label>
                <span className="faint">Email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </label>
            )}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : channel === "email" ? "Send confirmation email" : "Get Telegram link"}
            </button>
          </form>
        )}
        {result && (
          <div className={`notice ${result.tone === "warn" ? "warn" : "info"}`} role="status" style={{ marginTop: 12 }}>
            {result.text}{" "}
            {result.link && (
              <a href={result.link} target="_blank" rel="noreferrer">
                Open Telegram →
              </a>
            )}
          </div>
        )}
      </section>
    </>
  );
}
