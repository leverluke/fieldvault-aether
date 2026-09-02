/** ByteTrack++ style camera-motion compensation: translation of the frame. */

let prev: Float32Array | null = null;
let prevW = 0;
let prevH = 0;
let last = { dx: 0, dy: 0 };

const W = 64;
const H = 40;

let probe: HTMLCanvasElement | null = null;

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

function sad(a: Float32Array, b: Float32Array, dx: number, dy: number) {
  let s = 0;
  let n = 0;
  for (let y = 3; y < H - 3; y += 2) {
    for (let x = 3; x < W - 3; x += 2) {
      const x2 = x + dx;
      const y2 = y + dy;
      if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
      s += Math.abs(a[y * W + x] - b[y2 * W + x2]);
      n += 1;
    }
  }
  return n ? s / n : 1e9;
}

export function estimateCmc(canvas: HTMLCanvasElement): { dx: number; dy: number } {
  const cur = gray(canvas);
  if (!prev || prev.length !== cur.length) {
    prev = cur;
    prevW = W;
    prevH = H;
    last = { dx: 0, dy: 0 };
    return last;
  }
  let best = sad(prev, cur, 0, 0);
  let bx = 0;
  let by = 0;
  const span = 10;
  for (let dy = -span; dy <= span; dy += 1) {
    for (let dx = -span; dx <= span; dx += 1) {
      if (!dx && !dy) continue;
      const s = sad(prev, cur, dx, dy);
      if (s < best) {
        best = s;
        bx = dx;
        by = dy;
      }
    }
  }
  prev = cur;
  const zero = sad(cur, cur, 0, 0);
  if (best > 28 && best > zero * 1.8) {
    last = { dx: 0, dy: 0 };
    return last;
  }
  last = { dx: bx / W, dy: by / H };
  prevW = W;
  prevH = H;
  return last;
}

export function lastCmc() {
  return last;
}

let ox = 0;
let oy = 0;

export function shiftOrigin(dx: number, dy: number) {
  ox -= dx;
  oy -= dy;
}

export function origin() {
  return { x: ox, y: oy };
}

export function resetCmc() {
  prev = null;
  last = { dx: 0, dy: 0 };
  ox = 0;
  oy = 0;
}
