const KEY = "aether:taught";

export type Taught = {
  name: string;
  classHint?: string;
  vec: number[];
  t: number;
};

let bank: Taught[] = [];
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) bank = JSON.parse(raw) as Taught[];
  } catch {
    bank = [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(bank.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function taughtList() {
  load();
  return bank;
}

export function teachObject(name: string, vec: Float32Array, classHint?: string) {
  load();
  const row: Taught = { name: name.trim(), classHint, vec: Array.from(vec), t: Date.now() };
  const same = bank.filter((b) => b.name.toLowerCase() === row.name.toLowerCase());
  if (same.length >= 6) {
    const oldest = same.sort((a, b) => a.t - b.t)[0];
    bank = bank.filter((b) => b !== oldest);
  }
  bank.push(row);
  save();
}

let pending: { vec: Float32Array; hint?: string } | null = null;

export function setPendingTeach(vec: Float32Array, hint?: string) {
  pending = { vec, hint };
}

export function takePendingTeach() {
  const p = pending;
  pending = null;
  return p;
}

export function matchTaught(vec: Float32Array, min = 0.38): Taught | null {
  load();
  const byName = new Map<string, { row: Taught; s: number }>();
  for (const row of bank) {
    const a = vec;
    const b = row.vec;
    let d = 0;
    let na = 0;
    let nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      d += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const den = Math.sqrt(na) * Math.sqrt(nb);
    const s = den ? d / den : 0;
    const key = row.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev || s > prev.s) byName.set(key, { row, s });
  }
  let best: { row: Taught; s: number } | null = null;
  for (const v of byName.values()) {
    if (!best || v.s > best.s) best = v;
  }
  if (best && best.s >= min) return best.row;
  return null;
}

export function forgetTaught(name?: string) {
  load();
  bank = name ? bank.filter((b) => b.name !== name) : [];
  save();
}
