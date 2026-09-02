export type Bearing = "left" | "ahead" | "right";
export type Range = "near" | "mid" | "far";
export type Grasp = {
  cue: "handle" | "body" | "screen" | "rim";
  side: "left" | "right" | "center";
};

export type Depth = "closing" | "holding" | "receding";

type Rect = {
  class: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx?: number;
  vy?: number;
  score: number;
  id?: number;
  bearing?: Bearing;
  range?: Range;
  grasp?: Grasp;
  depth?: Depth;
};

const areas = new Map<number, number[]>();

const GRASPABLE = new Set(["bottle", "cup", "wine glass", "remote", "cell phone", "bowl", "mug"]);

export function bearingOf(x: number, w: number): Bearing {
  const cx = x + w / 2;
  if (cx < 0.33) return "left";
  if (cx > 0.67) return "right";
  return "ahead";
}

export function rangeOf(w: number, h: number): Range {
  const a = w * h;
  if (a >= 0.16) return "near";
  if (a >= 0.045) return "mid";
  return "far";
}

export function graspOf(o: Pick<Rect, "class" | "x" | "y" | "w" | "h">): Grasp | undefined {
  const c = o.class.replace(/^taught:/, "");
  if (!GRASPABLE.has(c) && c !== "bottle" && c !== "cup" && c !== "wine glass" && c !== "remote" && c !== "cell phone") {
    return undefined;
  }
  const tall = o.h > o.w * 1.15;
  const wide = o.w > o.h * 1.15;
  if (c === "bottle" || c === "wine glass") {
    return { cue: "body", side: "center" };
  }
  if (c === "cup" || c === "bowl") {
    return { cue: tall ? "rim" : "handle", side: wide ? "right" : "center" };
  }
  if (c === "remote") {
    return { cue: "body", side: wide ? (o.x + o.w / 2 < 0.5 ? "right" : "left") : "center" };
  }
  if (c === "cell phone") {
    return { cue: tall ? "body" : "screen", side: "center" };
  }
  return { cue: "body", side: "center" };
}

export function enrich<T extends Rect>(o: T): T {
  let depth: Depth | undefined;
  if (o.id != null) {
    const a = o.w * o.h;
    const hist = areas.get(o.id) ?? [];
    hist.push(a);
    if (hist.length > 6) hist.shift();
    areas.set(o.id, hist);
    if (hist.length >= 3) {
      const d = hist[hist.length - 1] - hist[0];
      if (d > 0.01) depth = "closing";
      else if (d < -0.01) depth = "receding";
      else depth = "holding";
    }
  }
  return {
    ...o,
    bearing: bearingOf(o.x, o.w),
    range: rangeOf(o.w, o.h),
    grasp: graspOf(o),
    depth,
  };
}

export function resetDepth() {
  areas.clear();
}

export function moving(o: { vx?: number; vy?: number }) {
  return Math.hypot(o.vx ?? 0, o.vy ?? 0) > 0.12;
}
