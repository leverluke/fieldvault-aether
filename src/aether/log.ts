import type { Reply } from "./types";

export type LogRow = { t: number; kind: string; detail: string };

const KEY = "aether:log";
const QUIET = "aether:quiet";
let rows: LogRow[] = [];
let undos: { label: string; fn: () => void }[] = [];
let pending: { label: string; run: () => Promise<Reply> | Reply } | null = null;

function load() {
  if (typeof window === "undefined") return;
  try {
    rows = JSON.parse(localStorage.getItem(KEY) || "[]") as LogRow[];
  } catch {
    rows = [];
  }
}
load();

export function logAction(kind: string, detail: string, undo?: () => void) {
  rows.unshift({ t: Date.now(), kind, detail });
  rows = rows.slice(0, 80);
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
  if (undo) undos.push({ label: detail, fn: undo });
}

export function undoStack() {
  return undos.slice().reverse();
}

export function undoLast() {
  const u = undos.pop();
  if (!u) return "Nothing to undo.";
  u.fn();
  logAction("undo", u.label);
  return `Undid: ${u.label}`;
}

export function setPending(label: string, run: NonNullable<typeof pending>["run"]) {
  pending = { label, run };
}

export function takePending() {
  const p = pending;
  pending = null;
  return p;
}

export function hasPending() {
  return pending;
}

export function quietHours() {
  try {
    const raw = localStorage.getItem(QUIET);
    if (!raw) return false;
    const [a, b] = raw.split("-").map(Number);
    const h = new Date().getHours();
    if (a < b) return h >= a && h < b;
    return h >= a || h < b;
  } catch {
    return false;
  }
}

export function getQuiet() {
  try {
    return localStorage.getItem(QUIET) || "";
  } catch {
    return "";
  }
}

export function setQuiet(range: string) {
  localStorage.setItem(QUIET, range);
}
