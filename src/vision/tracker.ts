import { kin } from "./classes";
import {
  BYTE_HIGH,
  BYTE_LOW,
  blendApp,
  cosine,
  galleryLook,
  metricLook,
  pushGallery,
} from "./deepsort";
import { logMiss } from "./miss";
import { kh, khPredict, khUpdate, type KH } from "./kalman";

type Rect = {
  class: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
  app?: Float32Array;
};

export type Track = Rect & {
  id: number;
  vx: number;
  vy: number;
  age: number;
  hits: number;
  trail: { x: number; y: number }[];
  pinned?: boolean;
  gallery?: Float32Array[];
  kx?: KH;
  ky?: KH;
  kw?: KH;
  kh?: KH;
  challenger?: string;
  challengerHits?: number;
};

type Grave = {
  id: number;
  class: string;
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  pinned?: boolean;
  app?: Float32Array;
  gallery?: Float32Array[];
};

function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua <= 0 ? 0 : inter / ua;
}

function clampBox(t: Track) {
  t.w = Math.min(1, Math.max(0.02, t.w));
  t.h = Math.min(1, Math.max(0.02, t.h));
  t.x = Math.min(1 - t.w, Math.max(0, t.x));
  t.y = Math.min(1 - t.h, Math.max(0, t.y));
}

function isFish(c: string) {
  return c === "fish" || c.startsWith("aquatic:") || c.startsWith("fish:");
}

function diou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const ov = iou(a, b);
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const cdx = Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x);
  const cdy = Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y);
  const c2 = cdx * cdx + cdy * cdy + 1e-6;
  const d2 = (acx - bcx) ** 2 + (acy - bcy) ** 2;
  return ov - d2 / c2;
}

function velAlign(t: Track, d: { x: number; y: number; w: number; h: number }) {
  const dx = d.x + d.w / 2 - (t.x + t.w / 2);
  const dy = d.y + d.h / 2 - (t.y + t.h / 2);
  const sp = Math.hypot(t.vx, t.vy);
  if (sp < 0.004) return 0;
  const dot = (t.vx * dx + t.vy * dy) / (sp * Math.hypot(dx, dy) + 1e-6);
  return dot;
}

function maxAgeFor(t: Track) {
  if (t.pinned) return 140;
  if (t.hits < 2) return 3;
  if (t.gallery && t.gallery.length >= 4 && t.hits >= 6) return 48;
  if (t.gallery && t.gallery.length >= 2 && t.hits >= 4) return 36;
  if (t.app && t.hits >= 4) return 28;
  if (t.hits < 4) return 6;
  if (t.score < 0.4) return 8;
  if (isFish(t.class)) return 22;
  if (t.class === "person" || t.class === "dog" || t.class === "cat" || t.class === "car" || t.class === "truck") return 32;
  return 20;
}

export class Tracker {
  private nextId = 1;
  private tracks: Track[] = [];
  private graves: Grave[] = [];
  private pinned = new Set<number>();
  maxAge = 40;

  constructor() {
    this.loadGraves();
  }

  private persistGraves() {
    if (typeof window === "undefined") return;
    try {
      const slim = this.graves.slice(-24).map((g) => ({
        ...g,
        app: g.app ? Array.from(g.app).filter((_, i) => i % 8 === 0) : undefined,
        gallery: undefined,
      }));
      localStorage.setItem("aether:graves", JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }

  private loadGraves() {
    if (typeof window === "undefined") return;
    try {
      const raw = JSON.parse(localStorage.getItem("aether:graves") || "[]") as Grave[];
      this.graves = raw.map((g) => ({
        ...g,
        app: g.app ? new Float32Array(g.app as unknown as number[]) : undefined,
      }));
    } catch {
      this.graves = [];
    }
  }

  adoptRemote(rows: { id: number; class: string; x: number; y: number; w: number; h: number; app?: number[] }[]) {
    for (const r of rows) {
      if (this.tracks.some((t) => t.id === r.id)) continue;
      this.graves.push({
        id: r.id,
        class: r.class,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        t: Date.now(),
        app: r.app ? new Float32Array(r.app) : undefined,
      });
    }
    this.persistGraves();
  }

  exportRemote() {
    return this.tracks.slice(0, 12).map((t) => ({
      id: t.id,
      class: t.class,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      app: t.app ? Array.from(t.app).filter((_, i) => i % 8 === 0) : undefined,
    }));
  }

  reset(hard = false) {
    for (const t of this.tracks) this.bury(t);
    this.tracks = [];
    if (hard) {
      this.nextId = 1;
      this.graves = [];
      this.pinned.clear();
    }
  }

  pin(id: number) {
    this.pinned.add(id);
    const t = this.tracks.find((x) => x.id === id);
    if (t) t.pinned = true;
  }

  unpin(id: number) {
    this.pinned.delete(id);
    const t = this.tracks.find((x) => x.id === id);
    if (t) t.pinned = false;
  }

  isPinned(id: number) {
    return this.pinned.has(id);
  }

  merge(keep: number, drop: number) {
    const a = this.tracks.find((t) => t.id === keep);
    const b = this.tracks.find((t) => t.id === drop);
    if (!a || !b) return false;
    a.hits += b.hits;
    if (b.gallery) a.gallery = [...(a.gallery || []), ...b.gallery].slice(-8);
    if (b.app) a.app = b.app;
    this.pinned.delete(drop);
    this.tracks = this.tracks.filter((t) => t.id !== drop);
    return true;
  }

  private bury(t: Track) {
    if (t.hits < 2 && !this.pinned.has(t.id)) return;
    this.graves.push({
      id: t.id,
      class: t.class,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      t: Date.now(),
      pinned: this.pinned.has(t.id),
      app: t.app,
      gallery: t.gallery,
    });
    logMiss({ t: Date.now(), kind: "lost", id: t.id, cls: t.class });
    this.persistGraves();
    if (this.graves.length > 80) this.graves.shift();
  }

  private claim(det: Rect): number | undefined {
    const now = Date.now();
    this.graves = this.graves.filter((g) => now - g.t < (g.pinned ? 240000 : 90000));
    let best: { i: number; cost: number } | null = null;
    for (let i = 0; i < this.graves.length; i++) {
      const g = this.graves[i];
      const look = Math.max(cosine(g.app, det.app), galleryLook(g.gallery, det.app));
      const related = kin(g.class, det.class) || g.class === det.class || look > 0.52;
      if (!related) continue;
      const ov = iou(g, det);
      const di = diou(g, det);
      const dist = Math.hypot(g.x + g.w / 2 - (det.x + det.w / 2), g.y + g.h / 2 - (det.y + det.h / 2));
      if (look < 0.42 && ov < 0.05 && dist > 0.38) continue;
      const motion = 1 - di + dist * 1.1;
      const cost = look > 0.15 ? motion * 0.32 + (1 - look) * 0.95 : motion;
      if (!best || cost < best.cost) best = { i, cost };
    }
    if (!best || best.cost > 1.35) return undefined;
    const g = this.graves.splice(best.i, 1)[0];
    logMiss({ t: Date.now(), kind: "recovered", id: g.id, as: g.id, cls: det.class });
    this.persistGraves();
    if (g.app && det.app) det.app = blendApp(g.app, det.app, 0.35);
    else if (g.app && !det.app) det.app = g.app;
    return g.id;
  }

  compensate(dx: number, dy: number) {
    if (!dx && !dy) return;
    if (Math.abs(dx) < 0.004 && Math.abs(dy) < 0.004) return;
    for (const t of this.tracks) {
      t.x += dx;
      t.y += dy;
      if (t.kx) t.kx.x += dx;
      if (t.ky) t.ky.x += dy;
      clampBox(t);
    }
  }

  predict(dt: number) {
    const d = Math.min(0.1, Math.max(0, dt));
    for (const t of this.tracks) {
      if (!t.kx) t.kx = kh(t.x + t.w / 2, t.vx);
      if (!t.ky) t.ky = kh(t.y + t.h / 2, t.vy);
      if (!t.kw) t.kw = kh(t.w, 0);
      if (!t.kh) t.kh = kh(t.h, 0);
      khPredict(t.kx, d, 0.028);
      khPredict(t.ky, d, 0.028);
      khPredict(t.kw, d, 0.02);
      khPredict(t.kh, d, 0.02);
      t.w = Math.min(1, Math.max(0.02, t.kw.x));
      t.h = Math.min(1, Math.max(0.02, t.kh.x));
      t.x = t.kx.x - t.w / 2;
      t.y = t.ky.x - t.h / 2;
      t.vx = t.kx.v;
      t.vy = t.ky.v;
      clampBox(t);
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      const last = t.trail[t.trail.length - 1];
      if (!last || Math.hypot(cx - last.x, cy - last.y) > 0.005) {
        t.trail.push({ x: cx, y: cy });
        if (t.trail.length > 64) t.trail.shift();
      }
    }
  }

  step(dets: Rect[], dt: number): Track[] {
    this.predict(dt);
    const unmatchedT = new Set(this.tracks.map((_, i) => i));
    const high = new Set<number>();
    const low = new Set<number>();
    dets.forEach((d, i) => {
      if (d.score >= BYTE_HIGH) high.add(i);
      else if (d.score >= BYTE_LOW) low.add(i);
    });
    const stepDt = Math.max(0.016, Math.min(0.22, dt || 0.08));
    this.match(dets, unmatchedT, high, "high", stepDt);
    this.match(dets, unmatchedT, low, "low", stepDt);
    const leftover = new Set<number>([...high, ...low]);
    if (unmatchedT.size && leftover.size) this.match(dets, unmatchedT, leftover, "recover", stepDt);
    for (const ti of unmatchedT) this.tracks[ti].age += 1;
    for (const di of high) {
      const det = dets[di];
      const area = det.w * det.h;
      if (det.score < 0.32) continue;
      if (det.score < 0.42 && area < 0.02) continue;
      if (area < 0.005) continue;
      if (this.tracks.some((t) => iou(t, det) > 0.28)) continue;
      const reused = this.claim(det);
      const g = det.app ? pushGallery(undefined, det.app) : undefined;
      this.tracks.push({
        id: reused ?? this.nextId++,
        class: det.class,
        score: det.score,
        x: det.x,
        y: det.y,
        w: det.w,
        h: det.h,
        vx: 0,
        vy: 0,
        age: 0,
        hits: reused ? 3 : 1,
        trail: [{ x: det.x + det.w / 2, y: det.y + det.h / 2 }],
        pinned: reused ? this.pinned.has(reused) : false,
        app: det.app,
        gallery: g,
        kx: kh(det.x + det.w / 2, 0),
        ky: kh(det.y + det.h / 2, 0),
        kw: kh(det.w, 0),
        kh: kh(det.h, 0),
      });
    }
    const keep: Track[] = [];
    for (const t of this.tracks) {
      if (t.age <= maxAgeFor(t)) keep.push(t);
      else this.bury(t);
    }
    this.tracks = this.dedupe(keep);
    return this.snapshot();
  }

  private match(dets: Rect[], trackIdx: Set<number>, detIdx: Set<number>, mode: "high" | "low" | "recover", dt: number) {
    const pairs: { ti: number; di: number; cost: number }[] = [];
    for (const ti of trackIdx) {
      const t = this.tracks[ti];
      const others = this.tracks.filter((_, i) => i !== ti).map((x) => x.gallery);
      const gateR = 0.18 + Math.sqrt((t.kx?.p00 ?? 0.04) + (t.ky?.p00 ?? 0.04)) * 2.2;
      for (const di of detIdx) {
        const d = dets[di];
        const ov = iou(t, d);
        const diu = diou(t, d);
        const dist = Math.hypot(t.x + t.w / 2 - (d.x + d.w / 2), t.y + t.h / 2 - (d.y + d.h / 2));
        if (mode === "low") {
          if (ov < 0.38) continue;
          pairs.push({ ti, di, cost: 1 - ov });
          continue;
        }
        const look = metricLook(t.gallery, d.app, others);
        const raw = t.app && d.app ? cosine(t.app, d.app) : galleryLook(t.gallery, d.app);
        const align = velAlign(t, d);
        const reach =
          (isFish(t.class) || isFish(d.class) ? 0.5 : 0.38) *
          (t.age > 0 ? 1.55 : 1) *
          (raw > 0.5 ? 1.85 : 1) *
          (align > 0.2 ? 1.25 : 1);
        if (mode === "recover") {
          if (look < 0.42 && ov < 0.12 && dist > 0.22) continue;
        } else {
          if (t.gallery?.length && d.app && look < 0.14 && ov < 0.5) continue;
          if (ov < 0.03 && dist > reach && look < 0.45) continue;
        }
        if (dist > gateR + 0.35 && look < 0.5 && ov < 0.1) continue;
        const related = kin(t.class, d.class) || look > 0.52;
        if (!related && ov < 0.32 && look < 0.46) continue;
        const classPen = related ? 0 : 0.38;
        const sizePen = Math.abs(t.w * t.h - d.w * d.h) * 0.65;
        const motion = (1 - diu) * 0.85 + dist * (isFish(t.class) ? 0.75 : 1.15) + classPen + sizePen - Math.max(0, align) * 0.12;
        const λ = t.gallery?.length && d.app ? 0.32 : 0.92;
        const cost = λ * motion + (1 - λ) * (1 - look) * 1.55;
        pairs.push({ ti, di, cost });
      }
    }
    pairs.sort((a, b) => a.cost - b.cost);
    const gate = mode === "low" ? 0.62 : mode === "recover" ? 1.55 : 1.55;
    for (const p of pairs) {
      if (!trackIdx.has(p.ti) || !detIdx.has(p.di)) continue;
      if (p.cost > gate) continue;
      trackIdx.delete(p.ti);
      detIdx.delete(p.di);
      this.updateTrack(this.tracks[p.ti], dets[p.di], dt);
    }
  }

  private updateTrack(t: Track, det: Rect, dt: number) {
    const cx = det.x + det.w / 2;
    const cy = det.y + det.h / 2;
    if (!t.kx) t.kx = kh(cx, t.vx);
    if (!t.ky) t.ky = kh(cy, t.vy);
    if (!t.kw) t.kw = kh(t.w, 0);
    if (!t.kh) t.kh = kh(t.h, 0);
    khUpdate(t.kx, cx);
    khUpdate(t.ky, cy);
    khUpdate(t.kw, det.w, 0.05);
    khUpdate(t.kh, det.h, 0.05);
    t.w = Math.min(1, Math.max(0.02, t.kw.x));
    t.h = Math.min(1, Math.max(0.02, t.kh.x));
    t.x = t.kx.x - t.w / 2;
    t.y = t.ky.x - t.h / 2;
    t.vx = t.kx.v;
    t.vy = t.ky.v;
    t.score = det.score * 0.7 + t.score * 0.3;
    if (det.class === t.class) {
      t.challengerHits = 0;
    } else if (t.hits >= 3) {
      if (t.challenger === det.class) t.challengerHits = (t.challengerHits ?? 0) + 1;
      else {
        t.challenger = det.class;
        t.challengerHits = 1;
      }
      if ((t.challengerHits ?? 0) >= 4) {
        t.class = det.class;
        t.challengerHits = 0;
      }
    } else {
      t.class = det.class;
    }
    t.age = 0;
    t.hits += 1;
    t.pinned = this.pinned.has(t.id);
    if (det.app) {
      const others = this.tracks.filter((x) => x.id !== t.id).map((x) => x.gallery);
      const keep = metricLook(t.gallery, det.app, others) >= 0.12 || !t.gallery?.length;
      if (keep) {
        t.gallery = pushGallery(t.gallery, det.app);
        t.app = blendApp(t.app, det.app, t.hits < 4 ? 0.4 : 0.14);
      }
    }
    clampBox(t);
    void dt;
  }

  private dedupe(list: Track[]): Track[] {
    const sorted = [...list].sort((a, b) => b.hits - a.hits || b.score - a.score);
    const out: Track[] = [];
    for (const t of sorted) {
      const clash = out.find((k) => iou(k, t) > 0.48 && (kin(k.class, t.class) || iou(k, t) > 0.7));
      if (clash) {
        if (this.pinned.has(t.id) && !this.pinned.has(clash.id)) {
          out.splice(out.indexOf(clash), 1, t);
        }
        continue;
      }
      out.push(t);
    }
    return out;
  }

  snapshot(): Track[] {
    return this.tracks.map((t) => ({
      ...t,
      trail: t.trail.slice(),
      gallery: t.gallery?.slice(),
      pinned: this.pinned.has(t.id) || t.pinned,
    }));
  }
}

export const tracker = new Tracker();
