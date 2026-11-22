import { useEffect, useState, type FormEvent } from "react";

import { AlertsOptIn } from "../components/AlertsOptIn.js";
import { TelegramAlert, useAlertsStatus } from "../components/TelegramAlert.js";
import { usd } from "../lib/format.js";
import { href } from "../lib/router.js";
import { looksLikeSeedPhrase } from "../lib/seed.js";
import { detectInput } from "../scan/index.js";
import type { Change } from "../watch/diff.js";
import {
  addToWatchlist,
  browserScanner,
  checkAll,
  checkItem,
  markRead,
  MAX_ITEMS,
  removeFromWatchlist,
  renameWatch,
  useWatchlist,
  type WatchItem,
} from "../watch/store.js";

function ago(iso?: string): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function ChangeRow({ c }: { c: Change }) {
  return (
    <li className={`w-change ${c.tone}`}>
      <span className="w-dot" aria-hidden />
      <div>
        <b>{c.title}</b> <span className="faint">· {ago(c.at)}</span>
        <div className="muted">{c.detail}</div>
      </div>
    </li>
  );
}

function Item({ item, telegram }: { item: WatchItem; telegram: boolean }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const snap = item.snapshot;
  const exposed = snap ? snap.holdings.filter((h) => h.status === "EXPOSED_NOW" && h.amountBase !== "0").length : 0;
  return (
    <article className={`card w-item ${item.unread ? "has-unread" : ""}`} aria-busy={item.checking}>
      <div className="w-head">
        <div style={{ minWidth: 0 }}>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                renameWatch(item.id, label);
                setEditing(false);
              }}
              className="row"
              style={{ gap: 6 }}
            >
              <input className="w-rename" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus aria-label="Label" />
              <button className="btn small" type="submit">
                Save
              </button>
            </form>
          ) : (
            <h3 style={{ margin: 0 }}>
              {item.label}{" "}
              <button className="link-btn" type="button" onClick={() => setEditing(true)} aria-label={`Rename ${item.label}`}>
                rename
              </button>
            </h3>
          )}
          <div className="mono faint w-input" title={item.input}>
            {item.input}
          </div>
        </div>
        <div className="w-score" title="Exposure score (0 = nothing exposed)">
          <b className={snap && snap.score > 0 ? "danger" : "ok"}>{snap ? snap.score : "—"}</b>
          <span className="faint">/100</span>
        </div>
      </div>

      <div className="w-stats">
        <span>
          <span className="faint">Exposed now</span> <b>{snap ? usd(snap.exposedUsd, { compact: true }) : "—"}</b>
        </span>
        <span>
          <span className="faint">Exposed holdings</span> <b>{snap ? exposed : "—"}</b>
        </span>
        <span>
          <span className="faint">Checked</span> <b>{item.checking ? "checking…" : ago(item.checkedAt)}</b>
        </span>
      </div>
      {item.checking && <div className="scanline" />}
      {item.error && <div className="notice warn" style={{ marginTop: 10 }}>{item.error}</div>}

      {item.changes.length > 0 ? (
        <ul className="w-changes">
          {item.changes.slice(0, 5).map((c, i) => (
            <ChangeRow key={i + c.at + c.kind} c={c} />
          ))}
        </ul>
      ) : (
        <p className="faint" style={{ margin: "12px 0 0", fontSize: 14 }}>
          {snap ? "No changes since you started watching." : "Baseline will be taken on the first check."}
        </p>
      )}

      {telegram && (
        <div className="row tg-row" style={{ gap: 8, marginTop: 14 }}>
          <TelegramAlert item={item} />
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <button className="btn small" type="button" disabled={item.checking} onClick={() => void checkItem(item.id, browserScanner)}>
          Check now
        </button>
        <a className="btn small" href={href({ name: "scan", input: item.input })}>
          Open scan
        </a>
        {item.unread > 0 && (
          <button className="btn small" type="button" onClick={() => markRead(item.id)}>
            Mark read
          </button>
        )}
        <span className="spacer" />
        <button className="link-btn danger" type="button" onClick={() => removeFromWatchlist(item.id)}>
          Remove
        </button>
      </div>
    </article>
  );
}

export function Watch() {
  const list = useWatchlist();
  const alerts = useAlertsStatus();
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const checking = list.some((i) => i.checking);

  // Re-check on every visit (items older than 15 min).
  useEffect(() => {
    void checkAll(browserScanner);
  }, []);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (looksLikeSeedPhrase(v)) {
      setValue("");
      setError("That looks like a seed phrase. Never paste it anywhere — we only need a public address or key.");
      return;
    }
    try {
      detectInput(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    const r = addToWatchlist(v, label);
    if (!r.ok) return setError(r.error);
    setValue("");
    setLabel("");
    setError(null);
    void checkItem(r.item.id, browserScanner);
  };

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Watchlist</div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Know <em className="serif">the moment</em> a key goes public
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            Saved on this device only. Every visit re-checks your entries and tells you if a spend revealed a key, new funds landed on an exposed one, or your score rose.
          </p>
        </div>
        {list.length > 0 && (
          <div className="row" style={{ gap: 8 }}>
            {list.some((i) => i.unread) && (
              <button className="btn small" type="button" onClick={() => markRead()}>
                Mark all read
              </button>
            )}
            <button className="btn small primary" type="button" disabled={checking} onClick={() => void checkAll(browserScanner, { force: true })}>
              {checking ? "Checking…" : "Check all now"}
            </button>
          </div>
        )}
      </div>

      <form className="card w-add" onSubmit={add}>
        <div className="w-add-row">
          <label className="sr-only" htmlFor="w-input">
            Address, public key or xpub to watch
          </label>
          <input
            id="w-input"
            className="mono"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="Bitcoin address, xpub, public key, 0x… or qor1…"
            autoComplete="off"
            spellCheck={false}
          />
          <label className="sr-only" htmlFor="w-label">
            Label (optional)
          </label>
          <input id="w-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" maxLength={40} />
          <button className="btn primary" type="submit" disabled={list.length >= MAX_ITEMS}>
            Watch
          </button>
        </div>
        <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>
          {list.length}/{MAX_ITEMS} entries · public data only, never a seed phrase or private key.
        </div>
        {error && (
          <div className="input-error" role="alert">
            {error}
          </div>
        )}
      </form>

      {list.length === 0 ? (
        <section className="card" style={{ marginTop: 20, textAlign: "center" }}>
          <h3>Nothing watched yet</h3>
          <p className="muted">Add an address above, or press “+ Watch” on any scan result.</p>
        </section>
      ) : (
        <div className="w-grid">
          {list.map((i) => (
            <Item key={i.id} item={i} telegram={!!alerts?.telegram} />
          ))}
        </div>
      )}

      <AlertsOptIn items={list} status={alerts} />
    </>
  );
}
