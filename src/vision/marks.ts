type Rect = { class: string; x: number; y: number; w: number; h: number; score?: number };

type Sig = Rect & { t: number };

const KEY = "aether-marks-v1";

let ignored: Sig[] = [];
let floor = 0;

function iou(a: Rect, b: Rect) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua <= 0 ? 0 : inter / ua;
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as { ignored?: Sig[]; floor?: number } | null;
    if (raw?.ignored) ignored = raw.ignored.slice(-40);
    if (typeof raw?.floor === "number") floor = raw.floor;
  } catch {
    /* ignore */
  }
}

function save() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ignored, floor }));
  } catch {
    /* ignore */
  }
}

load();

export function ignoreBox(o: Rect) {
  ignored = ignored.filter((s) => iou(s, o) < 0.7 || s.class !== o.class);
  ignored.push({ class: o.class, x: o.x, y: o.y, w: o.w, h: o.h, t: Date.now() });
  if (ignored.length > 40) ignored.shift();
  save();
}

export function isIgnored(o: Rect) {
  return ignored.some((s) => s.class === o.class && iou(s, o) > 0.32);
}

export function calibrateFrom(objects: Rect[]) {
  for (const o of objects) ignoreBox(o);
  if (objects.length) {
    const scores = objects.map((o) => o.score ?? 0.4).sort((a, b) => a - b);
    floor = Math.min(0.52, Math.max(0.36, scores[Math.floor(scores.length / 2)] + 0.04));
  } else {
    floor = Math.max(floor, 0.36);
  }
  save();
  return { ghosts: objects.length, floor };
}

export function extraFloor() {
  return floor;
}

export function ignoreCount() {
  return ignored.length;
}

export function clearMarks() {
  ignored = [];
  floor = 0;
  save();
}
