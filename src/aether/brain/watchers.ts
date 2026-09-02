import type { Frame } from "@/vision/detector";
import { speak } from "../speech";
import { isMuted } from "../memory";
import { quietHours } from "../log";

const KEY = "aether:watch";

export type Watcher = { id: string; cls: string; last?: number };

function load(): Watcher[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Watcher[];
  } catch {
    return [];
  }
}

function save(rows: Watcher[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 20)));
}

export function addWatcher(cls: string) {
  const id = Math.random().toString(36).slice(2, 8);
  save([{ id, cls: cls.toLowerCase() }, ...load().filter((w) => w.cls !== cls.toLowerCase())]);
  return id;
}

export function clearWatchers() {
  save([]);
}

export function listWatchers() {
  return load();
}

export function tickWatchers(frame: Frame) {
  const rows = load();
  if (!rows.length) return;
  const now = Date.now();
  let dirty = false;
  for (const w of rows) {
    const hit = frame.objects.find(
      (o) => o.layer !== "bg" && (o.class === w.cls || o.name === w.cls || (o.name || "").includes(w.cls)),
    );
    if (!hit) continue;
    if (w.last && now - w.last < 8000) continue;
    w.last = now;
    dirty = true;
    if (quietHours() || isMuted()) continue;
    const line = `Watcher: ${hit.name || hit.class} #${hit.id ?? "?"} ${hit.bearing || ""} ${hit.range || ""}.`;
    speak(line, isMuted());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aether:watch", { detail: line }));
    }
  }
  if (dirty) save(rows);
}
