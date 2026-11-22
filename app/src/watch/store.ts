/**
 * Browser-only watchlist. Lives in localStorage on this device — nothing is sent to our servers.
 * On each visit, items older than RECHECK_MS are re-scanned (one at a time, politely) and diffed.
 */
import { useEffect, useState } from "react";

import { scan } from "../scan/index.js";
import type { ScanResult } from "../scan/types.js";
import { diff, snapshotOf, type Change, type Snapshot } from "./diff.js";

export const STORAGE_KEY = "shors-reach.watchlist.v1";
export const MAX_ITEMS = 10;
export const RECHECK_MS = 15 * 60_000;
const MAX_CHANGES = 30;

export interface WatchItem {
  id: string;
  input: string;
  label: string;
  addedAt: string;
  snapshot?: Snapshot;
  checkedAt?: string;
  changes: Change[];
  unread: number;
  checking?: boolean;
  error?: string;
  /** Opt-in server alert linked to this entry (ids to poll / unsubscribe). */
  alert?: { channel: "telegram" | "email"; id: string; t: string; link?: string; status: "pending" | "active"; since: string };
}

// ---------------------------------------------------------------- persistence (never throws)
function load(): WatchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? (JSON.parse(raw) as WatchItem[]) : [];
    return Array.isArray(items) ? items.map((i) => ({ ...i, checking: false })) : [];
  } catch {
    return [];
  }
}
function save(items: WatchItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(({ checking: _c, ...rest }) => rest)));
  } catch {
    /* private mode / quota: the list still works for this session */
  }
}

let items: WatchItem[] = typeof window === "undefined" ? [] : load();
const subs = new Set<(i: WatchItem[]) => void>();
function set(next: WatchItem[]) {
  items = next;
  save(items);
  subs.forEach((f) => f(items));
}
const patch = (id: string, p: Partial<WatchItem>) => set(items.map((i) => (i.id === id ? { ...i, ...p } : i)));

/** Re-read storage (another tab changed it). */
export function reloadFromStorage() {
  items = load();
  subs.forEach((f) => f(items));
}

export function getWatchlist(): WatchItem[] {
  return items;
}

export function isWatched(input: string): boolean {
  return items.some((i) => i.input === input.trim());
}

export function defaultLabel(input: string): string {
  const v = input.trim();
  return v.length > 18 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v;
}

export type AddResult = { ok: true; item: WatchItem } | { ok: false; error: string };

/** Adds an input, optionally seeding it with a scan the user just ran (so the first visit has a baseline). */
export function addToWatchlist(input: string, label?: string, seed?: ScanResult): AddResult {
  const v = input.trim();
  if (!v) return { ok: false, error: "Nothing to watch." };
  const existing = items.find((i) => i.input === v);
  if (existing) return { ok: true, item: existing };
  if (items.length >= MAX_ITEMS) return { ok: false, error: `The watchlist holds up to ${MAX_ITEMS} entries. Remove one first.` };
  const now = new Date().toISOString();
  const item: WatchItem = {
    id: Math.random().toString(36).slice(2, 10),
    input: v,
    label: label?.trim() || defaultLabel(v),
    addedAt: now,
    snapshot: seed ? snapshotOf(seed) : undefined,
    checkedAt: seed ? now : undefined,
    changes: [],
    unread: 0,
  };
  set([...items, item]);
  return { ok: true, item };
}

export function removeFromWatchlist(id: string) {
  const item = items.find((i) => i.id === id);
  // Best effort: removing an entry also deletes its server-side alert.
  if (item?.alert && typeof fetch !== "undefined")
    void fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unsubscribe", id: item.alert.id, t: item.alert.t }) }).catch(() => {});
  set(items.filter((i) => i.id !== id));
}
export function setAlert(id: string, alert: WatchItem["alert"]) {
  patch(id, { alert });
}
export function renameWatch(id: string, label: string) {
  patch(id, { label: label.trim() || defaultLabel(items.find((i) => i.id === id)?.input ?? "") });
}
export function markRead(id?: string) {
  set(items.map((i) => (!id || i.id === id ? { ...i, unread: 0 } : i)));
}

export type Scanner = (input: string) => Promise<ScanResult>;

/** Re-scan one item and record what changed since its last snapshot. */
export async function checkItem(id: string, scanner: Scanner): Promise<Change[]> {
  const item = items.find((i) => i.id === id);
  if (!item) return [];
  patch(id, { checking: true, error: undefined });
  try {
    const r = await scanner(item.input);
    const snap = snapshotOf(r);
    const cur = items.find((i) => i.id === id);
    if (!cur) return [];
    const changes = cur.snapshot ? diff(cur.snapshot, snap) : [];
    patch(id, {
      checking: false,
      checkedAt: new Date().toISOString(),
      // A partial scan never replaces a complete baseline, so missing data can't hide a later change.
      snapshot: snap.partial && cur.snapshot && !cur.snapshot.partial ? cur.snapshot : snap,
      changes: [...changes, ...cur.changes].slice(0, MAX_CHANGES),
      unread: cur.unread + changes.filter((c) => c.tone === "alert").length,
      error: snap.partial ? "Some data sources didn't answer — results may be incomplete." : undefined,
    });
    return changes;
  } catch (err) {
    patch(id, { checking: false, checkedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

const due = (i: WatchItem, now: number) => !i.checkedAt || now - Date.parse(i.checkedAt) > RECHECK_MS;

let running: Promise<void> | null = null;
/** Re-scan every item that is due (or all, with force), one after another with a pause between. */
export function checkAll(scanner: Scanner, { force = false, pauseMs = 1500 } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    const now = Date.now();
    const todo = items.filter((i) => force || due(i, now)).map((i) => i.id);
    for (const [n, id] of todo.entries()) {
      if (n > 0) await new Promise((r) => setTimeout(r, pauseMs));
      await checkItem(id, scanner);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Live scanner used in the browser (QoreChain REST through the same-origin proxy). */
export const browserScanner: Scanner = (input) => scan(input, { qoreRest: "/lcd-testnet" });

export function useWatchlist(): WatchItem[] {
  const [s, setS] = useState(items);
  useEffect(() => {
    subs.add(setS);
    setS(items);
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && reloadFromStorage();
    window.addEventListener("storage", onStorage);
    return () => {
      subs.delete(setS);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return s;
}

/** Test helper. */
export function __resetWatchlist(next: WatchItem[] = []) {
  items = next;
  subs.forEach((f) => f(items));
}
