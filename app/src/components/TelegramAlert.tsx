import { useEffect, useState } from "react";

import { setAlert, type WatchItem } from "../watch/store.js";

export type AlertsStatus = { storage: boolean; email: boolean; telegram: boolean };

let cached: Promise<AlertsStatus> | null = null;
/** Which alert channels this deployment has switched on (fetched once per page load). */
export function useAlertsStatus(): AlertsStatus | null {
  const [s, setS] = useState<AlertsStatus | null>(null);
  useEffect(() => {
    cached ??= fetch("/api/alerts?action=status")
      .then((r) => (r.ok ? (r.json() as Promise<AlertsStatus>) : null))
      .then((x) => x ?? { storage: false, email: false, telegram: false })
      .catch(() => ({ storage: false, email: false, telegram: false }));
    let alive = true;
    void cached.then((x) => alive && setS(x));
    return () => {
      alive = false;
    };
  }, []);
  return s;
}

const post = (body: unknown) =>
  fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({
    ok: r.ok,
    body: (await r.json().catch(() => ({}))) as Record<string, string>,
  }));

const POLL_MS = 2500;
const PENDING_MAX_MS = 48 * 3600_000;

/**
 * One-tap Telegram alerts for a watchlist entry:
 *   tap → Telegram opens on the bot with the link pre-filled → user presses Start → this button turns green.
 */
export function TelegramAlert({ item }: { item: WatchItem }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alert = item.alert?.channel === "telegram" ? item.alert : undefined;

  // While pending, poll until the user has pressed Start (only while the tab is visible).
  useEffect(() => {
    if (!alert || alert.status !== "pending") return;
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const r = await post({ action: "check", id: alert.id, t: alert.t });
        if (stop) return;
        if (r.body.status === "active") setAlert(item.id, { ...alert, status: "active", since: new Date().toISOString() });
        else if (r.body.status === "gone" || Date.now() - Date.parse(alert.since) > PENDING_MAX_MS) setAlert(item.id, undefined);
      } catch {
        /* offline: try again on the next tick */
      }
    };
    const iv = setInterval(() => void tick(), POLL_MS);
    const onVis = () => void tick();
    document.addEventListener("visibilitychange", onVis);
    void tick();
    return () => {
      stop = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [alert, item.id]);

  const start = async () => {
    setError(null);
    setBusy(true);
    // Open the tab synchronously (inside the click) so popup blockers allow it; point it at Telegram once we have the link.
    const win = window.open("", "_blank");
    try {
      const r = await post({ action: "subscribe", channel: "telegram", input: item.input, label: item.label });
      if (!r.ok || !r.body.link) throw new Error(r.body.error ?? "Couldn't create the link.");
      setAlert(item.id, { channel: "telegram", id: r.body.id!, t: r.body.t!, link: r.body.link, status: "pending", since: new Date().toISOString() });
      if (win) win.location.href = r.body.link;
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const off = async () => {
    if (!alert) return;
    setBusy(true);
    await post({ action: "unsubscribe", id: alert.id, t: alert.t }).catch(() => null);
    setAlert(item.id, undefined);
    setBusy(false);
  };

  if (alert?.status === "active")
    return (
      <div className="tg-state on" role="status">
        <span>✓ Telegram alerts on</span>
        <button className="link-btn" type="button" onClick={() => void off()} disabled={busy}>
          Turn off
        </button>
      </div>
    );

  if (alert?.status === "pending")
    return (
      <div className="tg-state pending" role="status" aria-live="polite">
        <span className="tg-wait">
          <span className="live-dot" aria-hidden /> Waiting for you to press <b>Start</b> in Telegram…
        </span>
        <span className="row" style={{ gap: 8 }}>
          <a className="btn small primary" href={alert.link} target="_blank" rel="noopener">
            Open Telegram
          </a>
          <button className="link-btn" type="button" onClick={() => void off()} disabled={busy}>
            Cancel
          </button>
        </span>
      </div>
    );

  return (
    <>
      <button className="btn small tg-btn" type="button" onClick={() => void start()} disabled={busy} title="Get a Telegram message when this address's exposure changes">
        {busy ? "Opening Telegram…" : "🔔 Telegram alerts"}
      </button>
      {error && (
        <span className="input-error" role="alert" style={{ flexBasis: "100%" }}>
          {error}
        </span>
      )}
    </>
  );
}
