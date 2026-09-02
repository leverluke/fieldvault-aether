import type { Hull } from "./hull";

export type OccCell = { x: number; y: number };
export type Channel = "clear" | "port" | "starboard" | "blocked";
export type Occupancy = {
  cols: number;
  rows: number;
  blocked: boolean[];
  path: OccCell[];
  channel: Channel;
  bowBlocked: boolean;
};

const COLS = 18;
const ROWS = 12;

const FURNITURE = new Set([
  "chair",
  "couch",
  "bed",
  "dining table",
  "refrigerator",
  "potted plant",
  "toilet",
  "bench",
  "tv",
  "oven",
  "microwave",
  "sink",
  "laptop",
]);

const WATER_HAZARD = new Set([
  "person",
  "boat",
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
  "train",
  "bird",
  "dog",
  "cat",
  "horse",
  "cow",
  "sheep",
  "bench",
  "stop sign",
  "fire hydrant",
  "traffic light",
]);

const GROUND_HAZARD = new Set([
  ...FURNITURE,
  "person",
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
  "dog",
  "cat",
  "potted plant",
]);

type Rect = { class: string; x: number; y: number; w: number; h: number; range?: string };

function idx(c: number, r: number) {
  return r * COLS + c;
}

function hazardSet(hull?: Hull) {
  if (hull === "water") return WATER_HAZARD;
  if (hull === "ground") return GROUND_HAZARD;
  return FURNITURE;
}

function padCells(hull?: Hull) {
  return hull === "water" ? 2 : 1;
}

export function occupancy(objects: Rect[], goal?: { x: number; y: number }, hull?: Hull): Occupancy {
  const hazards = hazardSet(hull);
  const pad = padCells(hull);
  const blocked = new Array(COLS * ROWS).fill(false);
  for (const o of objects) {
    if (!hazards.has(o.class)) continue;
    if (hull === "water" && o.range === "far" && o.w * o.h < 0.04) continue;
    const c0 = Math.max(0, Math.floor(o.x * COLS));
    const r0 = Math.max(0, Math.floor(o.y * ROWS));
    const c1 = Math.min(COLS - 1, Math.floor((o.x + o.w) * COLS));
    const r1 = Math.min(ROWS - 1, Math.floor((o.y + o.h) * ROWS));
    for (let r = Math.max(0, r0 - pad); r <= Math.min(ROWS - 1, r1 + pad); r++) {
      for (let c = Math.max(0, c0 - pad); c <= Math.min(COLS - 1, c1 + pad); c++) {
        blocked[idx(c, r)] = true;
      }
    }
  }

  const startC = Math.floor(COLS / 2);
  const startR = ROWS - 2;
  const goalC = goal ? Math.min(COLS - 1, Math.max(0, Math.floor(goal.x * COLS))) : startC;
  const goalR = goal ? Math.min(ROWS - 1, Math.max(0, Math.floor(goal.y * ROWS))) : hull === "water" ? 1 : 2;
  blocked[idx(startC, startR)] = false;
  blocked[idx(goalC, goalR)] = false;

  const path = bfs(blocked, startC, startR, goalC, goalR, hull === "water");
  const channel = readChannel(blocked);
  const bowBlocked = bowIsBlocked(blocked);
  return {
    cols: COLS,
    rows: ROWS,
    blocked,
    path: path.map(([c, r]) => ({ x: (c + 0.5) / COLS, y: (r + 0.5) / ROWS })),
    channel,
    bowBlocked,
  };
}

function readChannel(blocked: boolean[]): Channel {
  let port = 0;
  let mid = 0;
  let star = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!blocked[idx(c, r)]) continue;
      if (c < 6) port += 1;
      else if (c > 11) star += 1;
      else mid += 1;
    }
  }
  if (mid >= 8 && port >= 6 && star >= 6) return "blocked";
  if (mid >= 6) return port <= star ? "port" : "starboard";
  if (port > star + 3) return "starboard";
  if (star > port + 3) return "port";
  return "clear";
}

function bowIsBlocked(blocked: boolean[]) {
  let n = 0;
  for (let r = 3; r <= 8; r++) {
    for (let c = 7; c <= 10; c++) if (blocked[idx(c, r)]) n += 1;
  }
  return n >= 6;
}

function bfs(
  blocked: boolean[],
  sc: number,
  sr: number,
  gc: number,
  gr: number,
  diag: boolean,
): [number, number][] {
  const start = idx(sc, sr);
  const goal = idx(gc, gr);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const q = [start];
  prev[start] = start;
  const dirs = diag
    ? [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]
    : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur === goal) break;
    const c = cur % COLS;
    const r = Math.floor(cur / COLS);
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = idx(nc, nr);
      if (prev[n] !== -1 || blocked[n]) continue;
      prev[n] = cur;
      q.push(n);
    }
  }
  if (prev[goal] === -1) return [];
  const out: [number, number][] = [];
  let cur = goal;
  while (cur !== start) {
    out.push([cur % COLS, Math.floor(cur / COLS)]);
    cur = prev[cur];
  }
  out.push([sc, sr]);
  out.reverse();
  return out;
}

export function pathYaw(path: OccCell[]): number {
  if (path.length < 2) return 0;
  const look = path[Math.min(6, path.length - 1)];
  return Math.max(-36, Math.min(36, (0.5 - look.x) * 72));
}

export function pathBlocked(occ?: Occupancy | null) {
  if (!occ) return false;
  return occ.channel === "blocked" || (occ.bowBlocked && occ.path.length < 2);
}
