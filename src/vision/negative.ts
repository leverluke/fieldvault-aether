const KEY = "aether:not";

let not: { class: string; x: number; y: number; w: number; h: number }[] = [];

function load() {
  if (typeof window === "undefined") return;
  try {
    not = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    not = [];
  }
}
load();

function iou(a: { x: number; y: number; w: number; h: number }, b: typeof a) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua <= 0 ? 0 : inter / ua;
}

export function notThis(o: { class: string; x: number; y: number; w: number; h: number }) {
  not.push({ class: o.class, x: o.x, y: o.y, w: o.w, h: o.h });
  if (not.length > 40) not.shift();
  localStorage.setItem(KEY, JSON.stringify(not));
}

export function isNegative(o: { class: string; x: number; y: number; w: number; h: number }) {
  return not.some((n) => n.class === o.class && iou(n, o) > 0.28);
}

export function clearNegatives() {
  not = [];
  localStorage.removeItem(KEY);
}
