import type { Frame } from "./detector";
import type { Occupancy } from "./occupancy";
import { drawSlam, getPose, project, worldToCanvas } from "./slam";
import { listWaypoints } from "./waypoints";

export type Memory = {
  id: number;
  class: string;
  name?: string;
  x: number;
  y: number;
  wx: number;
  wy: number;
  range?: string;
  bearing?: string;
  t: number;
  hits: number;
  missing: number;
  color?: string;
  layer?: string;
  trail?: { x: number; y: number }[];
};

const KEY = "aether:room";
const memories = new Map<number, Memory>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...memories.values()]));
  } catch {
    /* ignore */
  }
}

export function loadRoom() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const rows = JSON.parse(raw) as Memory[];
    memories.clear();
    for (const r of rows) memories.set(r.id, r);
  } catch {
    /* ignore */
  }
}

export function ingestRemote(rows: { id: number; class: string; name?: string; wx: number; wy: number }[]) {
  for (const r of rows) {
    const prev = memories.get(r.id + 10_000);
    memories.set(r.id + 10_000, {
      id: r.id + 10_000,
      class: r.class,
      name: r.name,
      x: 0,
      y: 0,
      wx: r.wx,
      wy: r.wy,
      t: Date.now(),
      hits: (prev?.hits ?? 0) + 1,
      missing: 0,
    });
  }
  persist();
}

export function ingest(frame: Frame) {
  const seen = new Set<number>();
  for (const o of frame.objects) {
    if (o.id == null) continue;
    seen.add(o.id);
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const p = project(cx, cy);
    const prev = memories.get(o.id);
    const trail = prev?.trail ? prev.trail.slice() : [];
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.02) {
      trail.push({ x: p.x, y: p.y });
      if (trail.length > 40) trail.shift();
    }
    memories.set(o.id, {
      id: o.id,
      class: prev?.class || o.name || o.class,
      name: o.name,
      x: cx,
      y: cy,
      wx: p.x,
      wy: p.y,
      range: o.range,
      bearing: o.bearing,
      t: frame.t,
      hits: (prev?.hits ?? 0) + 1,
      missing: 0,
      color: o.color,
      layer: o.layer,
      trail,
    });
  }
  for (const [, m] of memories) {
    if (!seen.has(m.id)) m.missing += 1;
  }
  persist();
}

export function rememberName(id: number, name: string) {
  const m = memories.get(id);
  if (m) {
    m.name = name;
    m.class = name;
    persist();
  }
}

export function findInRoom(q: string): Memory[] {
  const needle = q.toLowerCase();
  return [...memories.values()]
    .filter((m) => m.class.toLowerCase().includes(needle) || (m.name && m.name.toLowerCase().includes(needle)))
    .sort((a, b) => a.missing - b.missing || b.t - a.t);
}

export function roomList(): Memory[] {
  return [...memories.values()].sort((a, b) => a.missing - b.missing || b.hits - a.hits);
}

export function clearRoom() {
  memories.clear();
  persist();
}

export function drawRoom(canvas: HTMLCanvasElement, highlight?: string, occ?: Occupancy) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#141416";
  ctx.fillRect(0, 0, w, h);
  const pad = 10;
  drawSlam(ctx, w, h, pad);
  void occ;
  const pose = getPose();
  const you = worldToCanvas(pose.x, pose.y, w, h, pad);
  ctx.fillStyle = "#d4a054";
  ctx.save();
  ctx.translate(you.x, you.y);
  ctx.rotate(-pose.yaw);
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-6, 7);
  ctx.lineTo(6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = "10px ui-sans-serif, system-ui";
  for (const m of roomList()) {
    const pt = worldToCanvas(m.wx ?? m.x, m.wy ?? m.y, w, h, pad);
    const hot = !!(highlight && (m.class === highlight || m.name === highlight || String(m.id) === highlight));
    if (m.trail && m.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = hot ? "rgba(212,160,84,0.85)" : "rgba(154,149,140,0.45)";
      ctx.lineWidth = hot ? 2.4 : 1;
      m.trail.forEach((p, i) => {
        const q = worldToCanvas(p.x, p.y, w, h, pad);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = m.missing > 4 ? "#5c5850" : hot ? "#d4a054" : "#c8c4ba";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, hot ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`#${m.id} ${m.name || m.class}`, pt.x + 6, pt.y + 4);
  }
  for (const mark of listWaypoints()) {
    const pt = worldToCanvas(mark.wx, mark.wy, w, h, pad);
    ctx.fillStyle = mark.kind === "home" ? "#d4a054" : mark.kind === "nogo" ? "#c45c4a" : "#9a958c";
    ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
    ctx.fillText(mark.name, pt.x + 6, pt.y + 4);
  }
}

const ANCHORS = new Set([
  "couch",
  "chair",
  "bed",
  "dining table",
  "tv",
  "refrigerator",
  "oven",
  "sink",
  "door",
  "potted plant",
]);

function relTo(m: Memory, a: Memory) {
  const dx = (m.wx ?? m.x) - (a.wx ?? a.x);
  const dy = (m.wy ?? m.y) - (a.wy ?? a.y);
  const dist = Math.hypot(dx, dy);
  const name = a.name || a.class;
  if (dist < 0.12) return `by the ${name}`;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? `left of the ${name}` : `right of the ${name}`;
  return dy < 0 ? `above the ${name}` : `in front of the ${name}`;
}

export function landmarkOf(m: Memory): string | undefined {
  let best: { a: Memory; d: number } | null = null;
  for (const a of memories.values()) {
    if (a.id === m.id) continue;
    const isAnchor = ANCHORS.has(a.class) || ANCHORS.has((a.name || "").toLowerCase());
    if (!isAnchor && a.layer !== "bg") continue;
    const d = Math.hypot((m.wx ?? m.x) - (a.wx ?? a.x), (m.wy ?? m.y) - (a.wy ?? a.y));
    if (!best || d < best.d) best = { a, d };
  }
  if (!best || best.d > 0.55) return undefined;
  return relTo(m, best.a);
}

export function inventory() {
  const rows = roomList();
  const live = rows.filter((m) => m.missing < 4);
  const gone = rows.filter((m) => m.missing >= 4).slice(0, 8);
  if (!live.length && !gone.length) return "Nothing on the sketch yet. Open eyes and walk.";
  const now = live.map((m) => `#${m.id} ${m.name || m.class}`).join(", ");
  const lost = gone.map((m) => `#${m.id} ${m.name || m.class}`).join(", ");
  return `${live.length ? `In view or just gone: ${now}.` : "Nothing live."}${lost ? ` Last seen: ${lost}.` : ""}`;
}

export function whereIs(q: string) {
  const hits = findInRoom(q);
  if (!hits.length) return `I haven't seen ${q} this session.`;
  return describeMemory(hits[0]);
}

export function describeMemory(m: Memory) {
  const age = Math.max(0, Math.round((Date.now() - m.t) / 1000));
  const when = age < 3 ? "just now" : age < 60 ? `${age}s ago` : "a while ago";
  const place = landmarkOf(m);
  const where = place || m.bearing || "";
  return `#${m.id} ${m.name || m.class} ${where} ${m.range || ""}, last seen ${when}`.replace(/\s+/g, " ").trim();
}
