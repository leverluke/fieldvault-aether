import { imuYaw } from "./imu";

export type Pose = { x: number; y: number; yaw: number };

const W = 64;
const H = 40;
const GS = 56;
const WORLD = 6;

let probe: HTMLCanvasElement | null = null;
let prev: Float32Array | null = null;
let pose: Pose = { x: 0, y: 0, yaw: 0 };
let lastVo = { dx: 0, dy: 0, yaw: 0 };
const grid = new Uint8Array(GS * GS);
const heat = new Uint8Array(GS * GS);
type Kf = { pose: Pose; gray: Float32Array };
let keyframes: Kf[] = [];
let moved = 0;

function gray(canvas: HTMLCanvasElement): Float32Array {
  if (!probe) probe = document.createElement("canvas");
  probe.width = W;
  probe.height = H;
  const ctx = probe.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const g = new Float32Array(W * H);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    g[j] = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
  }
  return g;
}

function sadBand(a: Float32Array, b: Float32Array, dx: number, dy: number, x0: number, x1: number) {
  let s = 0;
  let n = 0;
  for (let y = 3; y < H - 3; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const x2 = x + dx;
      const y2 = y + dy;
      if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
      s += Math.abs(a[y * W + x] - b[y2 * W + x2]);
      n += 1;
    }
  }
  return n ? s / n : 1e9;
}

function bestShift(a: Float32Array, b: Float32Array, x0: number, x1: number, span = 9) {
  let best = sadBand(a, b, 0, 0, x0, x1);
  let bx = 0;
  let by = 0;
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -span; dx <= span; dx++) {
      if (!dx && !dy) continue;
      const s = sadBand(a, b, dx, dy, x0, x1);
      if (s < best) {
        best = s;
        bx = dx;
        by = dy;
      }
    }
  }
  return { dx: bx, dy: by, err: best };
}

function cell(wx: number, wy: number) {
  const c = Math.floor(((wx + WORLD / 2) / WORLD) * GS);
  const r = Math.floor(((wy + WORLD / 2) / WORLD) * GS);
  if (c < 0 || r < 0 || c >= GS || r >= GS) return -1;
  return r * GS + c;
}

export function project(nx: number, ny: number, p: Pose = pose) {
  const depth = 0.28 + (1 - ny) * 1.7;
  const ang = p.yaw + (nx - 0.5) * 0.95;
  return {
    x: p.x + Math.sin(ang) * depth,
    y: p.y + Math.cos(ang) * depth,
  };
}

export function getPose(): Pose {
  return { ...pose };
}

export function describePose() {
  const deg = ((pose.yaw * 180) / Math.PI + 3600) % 360;
  const dist = Math.hypot(pose.x, pose.y);
  const cells = grid.filter((v) => v > 1).length;
  return `Heading ${deg.toFixed(0)} degrees. About ${dist.toFixed(1)} walk-units from start. ${cells} occupied cells on the sketch.`;
}

export function slamGrid() {
  return { cols: GS, rows: GS, world: WORLD, data: grid, pose: getPose() };
}

function loopClose(cur: Float32Array) {
  if (keyframes.length < 3) return false;
  let best = { i: -1, err: 18 };
  for (let i = 0; i < keyframes.length - 1; i++) {
    const e = sadBand(keyframes[i].gray, cur, 0, 0, 8, W - 8);
    const dist = Math.hypot(pose.x - keyframes[i].pose.x, pose.y - keyframes[i].pose.y);
    if (dist < 0.35) continue;
    if (e < best.err) best = { i, err: e };
  }
  if (best.i < 0) return false;
  const kf = keyframes[best.i];
  pose.x = pose.x * 0.55 + kf.pose.x * 0.45;
  pose.y = pose.y * 0.55 + kf.pose.y * 0.45;
  pose.yaw = pose.yaw * 0.55 + kf.pose.yaw * 0.45;
  return true;
}

export function stepSlam(canvas: HTMLCanvasElement): { dx: number; dy: number; yaw: number } {
  const cur = gray(canvas);
  if (!prev) {
    prev = cur;
    keyframes = [{ pose: { ...pose }, gray: cur }];
    lastVo = { dx: 0, dy: 0, yaw: 0 };
    return lastVo;
  }
  const mid = bestShift(prev, cur, 16, 48, 10);
  const left = bestShift(prev, cur, 2, 22, 8);
  const right = bestShift(prev, cur, 42, 62, 8);
  prev = cur;
  const dx = mid.dx / W;
  const dy = mid.dy / H;
  let yaw = ((right.dx - left.dx) / W) * 0.9;
  if (Math.abs(yaw) < 0.004) yaw = dx * 0.35;
  yaw = Math.max(-0.14, Math.min(0.14, yaw));
  if (mid.err > 32) {
    lastVo = { dx: 0, dy: 0, yaw: 0 };
    return lastVo;
  }
  pose.yaw += yaw + imuYaw() * 0.65;
  const fwd = -dy;
  const strafe = -dx * 0.45;
  pose.x += Math.sin(pose.yaw) * fwd + Math.cos(pose.yaw) * strafe;
  pose.y += Math.cos(pose.yaw) * fwd - Math.sin(pose.yaw) * strafe;
  lastVo = { dx, dy, yaw };
  moved += Math.hypot(fwd, strafe) + Math.abs(yaw);
  if (moved > 0.22) {
    moved = 0;
    keyframes.push({ pose: { ...pose }, gray: cur });
    if (keyframes.length > 14) keyframes.shift();
    loopClose(cur);
  }
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > 0 && Math.random() < 0.02) grid[i] -= 1;
  }
  return lastVo;
}

export function stampSlam(objects: { x: number; y: number; w: number; h: number; class: string; score: number }[]) {
  for (const o of objects) {
    if (o.score < 0.38) continue;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const p = project(cx, cy);
    const i = cell(p.x, p.y);
    if (i < 0) continue;
    grid[i] = Math.min(12, grid[i] + 2);
    if (o.class === "person") {
      heat[i] = Math.min(20, heat[i] + 2);
    }
    const i2 = cell(p.x + 0.08, p.y);
    if (i2 >= 0) grid[i2] = Math.min(12, grid[i2] + 1);
  }
  const feet = cell(pose.x, pose.y);
  if (feet >= 0) grid[feet] = 0;
}

export function drawSlam(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad = 10,
) {
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const cw = iw / GS;
  const rh = ih / GS;
  for (let r = 0; r < GS; r++) {
    for (let c = 0; c < GS; c++) {
      const v = grid[r * GS + c];
      if (!v) continue;
      ctx.fillStyle = `rgba(92,88,80,${Math.min(0.55, 0.12 + v * 0.05)})`;
      ctx.fillRect(pad + c * cw, pad + (GS - 1 - r) * rh, cw, rh);
      const hv = heat[r * GS + c];
      if (hv) {
        ctx.fillStyle = `rgba(196,92,74,${Math.min(0.4, hv * 0.03)})`;
        ctx.fillRect(pad + c * cw, pad + (GS - 1 - r) * rh, cw, rh);
      }
    }
  }
}

export function canvasToWorld(px: number, py: number, w: number, h: number, pad = 10) {
  const wx = ((px - pad) / (w - pad * 2)) * WORLD - WORLD / 2;
  const wy = (1 - (py - pad) / (h - pad * 2)) * WORLD - WORLD / 2;
  return { wx, wy };
}

export function worldToCanvas(wx: number, wy: number, w: number, h: number, pad = 10) {
  const c = ((wx + WORLD / 2) / WORLD) * (w - pad * 2) + pad;
  const r = (1 - (wy + WORLD / 2) / WORLD) * (h - pad * 2) + pad;
  return { x: c, y: r };
}

export function floorplanPng(): string {
  const c = document.createElement("canvas");
  c.width = GS * 4;
  c.height = GS * 4;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#141416";
  ctx.fillRect(0, 0, c.width, c.height);
  for (let r = 0; r < GS; r++) {
    for (let col = 0; col < GS; col++) {
      const v = grid[r * GS + col];
      const hv = heat[r * GS + col];
      if (v) {
        ctx.fillStyle = `rgba(154,149,140,${0.2 + v * 0.06})`;
        ctx.fillRect(col * 4, (GS - 1 - r) * 4, 4, 4);
      }
      if (hv) {
        ctx.fillStyle = `rgba(196,92,74,${hv * 0.05})`;
        ctx.fillRect(col * 4, (GS - 1 - r) * 4, 4, 4);
      }
    }
  }
  return c.toDataURL("image/png");
}

export function resetSlam() {
  prev = null;
  pose = { x: 0, y: 0, yaw: 0 };
  lastVo = { dx: 0, dy: 0, yaw: 0 };
  grid.fill(0);
  heat.fill(0);
  keyframes = [];
  moved = 0;
}
