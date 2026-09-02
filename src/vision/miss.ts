export type Miss = { t: number; kind: "lost" | "recovered"; id: number; as?: number; cls: string };

const KEY = "aether:miss";
let rows: Miss[] = [];

function load() {
  if (typeof window === "undefined" || rows.length) return;
  try {
    rows = JSON.parse(localStorage.getItem(KEY) || "[]") as Miss[];
  } catch {
    rows = [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function logMiss(row: Miss) {
  load();
  rows.unshift(row);
  rows = rows.slice(0, 40);
  save();
}

export function missLog() {
  load();
  return rows;
}

export function missLine() {
  load();
  if (!rows.length) return "No lost IDs this session.";
  return rows
    .slice(0, 6)
    .map((r) =>
      r.kind === "lost" ? `lost #${r.id} ${r.cls}` : `recovered #${r.id} as #${r.as ?? r.id} ${r.cls}`,
    )
    .join(" · ");
}
