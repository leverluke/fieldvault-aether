const KEY = "aether:routines";

export type Routine = { name: string; steps: string[] };

const DEFAULTS: Routine[] = [
  { name: "morning", steps: ["status", "what's next", "what do you see"] },
  { name: "leave", steps: ["what's next", "path clear"] },
  { name: "inspect", steps: ["open your eyes", "what do you see", "tour the sketch"] },
];

function load(): Routine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const rows = JSON.parse(raw) as Routine[];
    return rows.length ? rows : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(rows: Routine[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 20)));
}

export function listRoutines() {
  return load();
}

export function saveRoutine(name: string, steps: string[]) {
  const n = name.toLowerCase().trim();
  save([{ name: n, steps }, ...load().filter((r) => r.name !== n)]);
}

export function getRoutine(name: string) {
  const n = name.toLowerCase().trim();
  return load().find((r) => r.name === n || n.includes(r.name));
}
