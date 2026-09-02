const KEY = "aether:facts";

export type Fact = { k: string; v: string; t: number };

function load(): Fact[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Fact[];
  } catch {
    return [];
  }
}

function save(rows: Fact[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 80)));
}

export function setFact(k: string, v: string) {
  const key = k.toLowerCase().trim();
  const rows = load().filter((f) => f.k !== key);
  rows.unshift({ k: key, v: v.trim(), t: Date.now() });
  save(rows);
}

export function getFact(q: string) {
  const n = q.toLowerCase();
  return load().find((f) => n.includes(f.k) || f.k.includes(n));
}

export function listFacts() {
  return load();
}
