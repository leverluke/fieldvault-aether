import type { DetectedObject, ObjectDetection } from "@tensorflow-models/coco-ssd";
import type { MobileNet } from "@tensorflow-models/mobilenet";
import { tracker, type Track } from "./tracker";
import { SCENE, kin } from "./classes";
import { enrich, resetDepth } from "./spatial";
import { matchTaught, taughtList } from "./teach";
import { backendNote, setBackend } from "./backend";
import { occupancy, type Occupancy } from "./occupancy";
import { loadHull } from "./hull";
import { detectYolo, loadYolo, yoloReady } from "./yolo";
import { colorFromCanvas, parseColor, type ColorName } from "./color";
import { extraFloor, isIgnored } from "./marks";
import { glareFloor, nightInfo } from "./glare";
import { loadOcr, readStencil } from "./ocr";
import { isNegative } from "./negative";
import { estimateHands, loadHands } from "./hands";
import { lastSound } from "./yamnet";
import { loadOpenVocab, openVocabSlot } from "./openvocab";
import { setScaleFromPerson, metersPerUnit } from "./waypoints";
import { setFail } from "@/aether/fail";
import { resetCmc } from "./cmc";
import { refineFromNet, refineShape } from "./refine";
import { getPose, resetSlam, stampSlam, stepSlam } from "./slam";
import { estimatePoses, loadPose, matchPose } from "./pose";
import { estimateFaces, loadFaces } from "./faces";
import { imuYaw, startImu } from "./imu";

export { parseSeek, parseWatch, SCENE } from "./classes";

export type Box = {
  id?: number;
  class: string;
  name?: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx?: number;
  vy?: number;
  trail?: { x: number; y: number }[];
  bearing?: "left" | "ahead" | "right";
  range?: "near" | "mid" | "far";
  meters?: number;
  grasp?: { cue: "handle" | "body" | "screen" | "rim"; side: "left" | "right" | "center" };
  depth?: "closing" | "holding" | "receding";
  color?: ColorName;
  pinned?: boolean;
  kind?: string;
  layer?: "must" | "bg";
  coasting?: boolean;
  app?: Float32Array;
  quality?: number;
  stable?: boolean;
  px?: number;
  py?: number;
  hits?: number;
  stance?: "standing" | "sitting" | "fallen" | "unknown";
  pose?: { name: string; x: number; y: number; score: number }[];
  stencil?: string;
};

export type Frame = {
  t: number;
  w: number;
  h: number;
  objects: Box[];
  block: boolean;
  ms?: number;
  seek?: string;
  seekId?: number;
  watch?: string[];
  color?: string;
  backend?: string;
  occupancy?: Occupancy;
  cmc?: { dx: number; dy: number };
  pose?: { x: number; y: number; yaw: number };
  faces?: number;
  night?: boolean;
  loud?: number;
  failsafe?: string;
  models?: { primary: string; secondary: string; bank: number; slot: string };
};

export const VEHICLES = new Set(["car", "truck", "bus", "motorcycle", "bicycle", "boat", "airplane", "train"]);
export const PEOPLE = new Set(["person"]);
export const ANIMALS = new Set([
  "dog",
  "cat",
  "bird",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "fish",
]);
export const AQUATIC_LABELS = [
  "goldfish",
  "great white shark",
  "tiger shark",
  "hammerhead",
  "electric ray",
  "stingray",
  "barracouta",
  "eel",
  "coho",
  "rock beauty",
  "anemone fish",
  "sturgeon",
  "gar",
  "lionfish",
  "puffer",
  "tench",
];

function isAquaticClass(c: string) {
  return c === "fish" || c.startsWith("aquatic:") || c.startsWith("fish:");
}

function isAnimalClass(c: string) {
  return ANIMALS.has(c) || isAquaticClass(c);
}

const FILTERS: Record<string, (c: string) => boolean> = {
  all: () => true,
  people: (c) => PEOPLE.has(c),
  vehicles: (c) => VEHICLES.has(c),
  traffic: (c) => PEOPLE.has(c) || VEHICLES.has(c) || c === "stop sign" || c === "traffic light",
  animals: (c) => isAnimalClass(c),
  fish: (c) => isAquaticClass(c),
  scene: (c) => SCENE.has(c),
};

export const FILTER_IDS = ["all", "scene", "people", "vehicles", "traffic", "animals", "fish"] as const;
export type FilterId = (typeof FILTER_IDS)[number];

const BANK: { label: string; src: string }[] = [
  { label: "dog", src: "/media/brain/dog-1.jpg" },
  { label: "dog", src: "/media/brain/dog-2.jpg" },
  { label: "dog", src: "/media/brain/dog-3.jpg" },
  { label: "dog", src: "/media/brain/dog-4.jpg" },
  { label: "fish", src: "/media/brain/fish-1.jpg" },
  { label: "fish", src: "/media/brain/fish-2.jpg" },
  { label: "fish", src: "/media/brain/fish-3.jpg" },
  { label: "fish", src: "/media/brain/fish-4.jpg" },
];

type Prototype = { label: string; vec: Float32Array };

let coco: ObjectDetection | null = null;
let net: MobileNet | null = null;
let prototypes: Prototype[] = [];
let brainPromise: Promise<void> | null = null;
let work: HTMLCanvasElement | null = null;
let workCtx: CanvasRenderingContext2D | null = null;
let probe: HTMLCanvasElement | null = null;
let probeCtx: CanvasRenderingContext2D | null = null;
let lastDetectAt = 0;
let secondaryTick = 0;
let seekClass: string | undefined;
let seekColor: ColorName | undefined;
let seekId: number | undefined;
let watchList: string[] = [];
let bgMode: "none" | "furniture" | "all" = "furniture";
let seekHoldUntil = 0;

function workCanvas() {
  if (!work) {
    work = document.createElement("canvas");
    workCtx = work.getContext("2d", { willReadFrequently: true });
  }
  return { canvas: work!, ctx: workCtx! };
}

function probeCanvas() {
  if (!probe) {
    probe = document.createElement("canvas");
    probeCtx = probe.getContext("2d", { willReadFrequently: true });
  }
  return { canvas: probe!, ctx: probeCtx! };
}

function srcSize(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
  const w =
    "videoWidth" in input && input.videoWidth
      ? input.videoWidth
      : "naturalWidth" in input && input.naturalWidth
        ? input.naturalWidth
        : input.width;
  const h =
    "videoHeight" in input && input.videoHeight
      ? input.videoHeight
      : "naturalHeight" in input && input.naturalHeight
        ? input.naturalHeight
        : input.height;
  return { w, h };
}

function drawWork(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, max = 448) {
  const { w, h } = srcSize(input);
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.max(32, Math.round(w * scale));
  const ch = Math.max(32, Math.round(h * scale));
  const { canvas, ctx } = workCanvas();
  canvas.width = cw;
  canvas.height = ch;
  ctx.drawImage(input, 0, 0, cw, ch);
  return { canvas, w, h, cw, ch };
}

async function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
  return img;
}

function cosine(a: Float32Array, b: Float32Array) {
  let d = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den ? d / den : 0;
}

async function embed(input: HTMLImageElement | HTMLCanvasElement) {
  if (!net) return null;
  const t = net.infer(input, true);
  const data = (await t.data()) as Float32Array;
  t.dispose();
  return new Float32Array(data);
}

async function loadBank() {
  if (!net) return;
  const next: Prototype[] = [];
  for (const item of BANK) {
    try {
      const img = await loadImage(item.src);
      const vec = await embed(img);
      if (vec) next.push({ label: item.label, vec });
    } catch {
      /* skip */
    }
  }
  prototypes = next;
}

export async function embedCrop(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
) {
  await loadModel();
  const cnv = crop(input, box.x, box.y, box.w, box.h);
  return embed(cnv);
}

export function loadModel() {
  if (!brainPromise) {
    brainPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const [cocoMod, mobileMod] = await Promise.all([
        import("@tensorflow-models/coco-ssd"),
        import("@tensorflow-models/mobilenet"),
      ]);
      const [c, m] = await Promise.all([
        cocoMod.load({ base: "mobilenet_v2" }),
        mobileMod.load({ version: 2, alpha: 0.5 }),
      ]);
      coco = c;
      net = m;
      await loadBank();
      void loadYolo().then((y) => {
        if (y) setBackend("yolo");
      });
      void loadPose();
      void loadFaces();
      void loadOcr();
      void loadHands();
      void loadOpenVocab();
      startImu();
    })();
  }
  return brainPromise;
}

export function setSeek(cls?: string, color?: string) {
  seekClass = cls;
  seekColor = color ? parseColor(color) || (color as ColorName) : undefined;
  if (cls && !seekColor) seekColor = parseColor(cls);
  if (cls) seekHoldUntil = Date.now() + 4000;
  if (!cls) seekId = undefined;
}

export function setSeekId(id?: number) {
  seekId = id;
}

export function getSeek() {
  return seekClass;
}

export function getSeekId() {
  return seekId;
}

export function getSeekColor() {
  return seekColor;
}

export function setWatch(list?: string[]) {
  watchList = (list || []).map((c) => c.toLowerCase());
}

export function getWatch() {
  return watchList;
}

export function setBackground(mode: "none" | "furniture" | "all") {
  bgMode = mode;
}

export function getBackground() {
  return bgMode;
}

function layerOf(c: string, name?: string, id?: number): "must" | "bg" | null {
  if (seekId != null && id === seekId) return "must";
  if (seekClass && (c === seekClass || name === seekClass || name?.includes(seekClass))) return "must";
  const taughtHit = taughtList().some((t) => t.name.toLowerCase() === (name || c).toLowerCase());
  if (taughtHit) return "must";
  if (watchList.includes(c) || (name && watchList.includes(name))) return "must";
  if (bgMode === "none") return "must";
  if (PEOPLE.has(c) || VEHICLES.has(c) || isAnimalClass(c) || c === "hand") return "must";
  if (bgMode === "all") return "bg";
  if (SCENE.has(c)) return "bg";
  if (!watchList.length) return "must";
  return "bg";
}

function allowed(c: string, name?: string, id?: number) {
  return layerOf(c, name, id) != null;
}

function matchesSeek(o: Box) {
  if (seekId != null && o.id === seekId) return true;
  if (!seekClass) return false;
  const cls = o.class === seekClass || o.name === seekClass || o.kind === seekClass;
  if (!cls) return false;
  if (seekColor && o.color && o.color !== seekColor) return false;
  return true;
}

function blocked(objects: Box[]) {
  return objects.some((o) => {
    const threat = PEOPLE.has(o.class) || VEHICLES.has(o.class) || isAnimalClass(o.class);
    if (!threat) return false;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    return cx > 0.3 && cx < 0.7 && cy > 0.22 && cy < 0.88 && o.score >= 0.4;
  });
}

function crop(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
) {
  const { w, h } = srcSize(input);
  const { canvas, ctx } = probeCanvas();
  canvas.width = 144;
  canvas.height = 144;
  ctx.drawImage(input, nx * w, ny * h, nw * w, nh * h, 0, 0, 144, 144);
  return canvas;
}

function boxIou(a: Box, b: Box) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua <= 0 ? 0 : inter / ua;
}

function nms(boxes: Box[], thresh = 0.42): Box[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep: Box[] = [];
  for (const b of sorted) {
    const hit = keep.some((k) => {
      const ov = boxIou(k, b);
      if (ov > 0.68) return true;
      if ((kin(k.class, b.class) || k.class === b.class) && ov > thresh) return true;
      return false;
    });
    if (!hit) keep.push(b);
  }
  return keep;
}

const BIG_OK = new Set(["couch", "bed", "dining table", "boat", "bus", "train", "airplane"]);

function pruneBoxes(boxes: Box[]): Box[] {
  return boxes.filter((a, i) => {
    const area = a.w * a.h;
    if (area > 0.58 && !BIG_OK.has(a.class) && a.score < 0.72) return false;
    if (area < 0.005 && a.score < 0.4) return false;
    const worse = boxes.some((b, j) => {
      if (i === j) return false;
      const ov = boxIou(a, b);
      const aWraps =
        a.x <= b.x + 0.015 &&
        a.y <= b.y + 0.015 &&
        a.x + a.w >= b.x + b.w - 0.015 &&
        a.y + a.h >= b.y + b.h - 0.015 &&
        area > b.w * b.h * 1.65;
      if (aWraps && (kin(a.class, b.class) || ov > 0.28)) return true;
      if (ov > 0.5 && a.score <= b.score && (kin(a.class, b.class) || ov > 0.7)) return true;
      return false;
    });
    return !worse;
  });
}

function novelOnly(extra: Box[], existing: Box[]): Box[] {
  return extra.filter(
    (e) => !existing.some((o) => boxIou(o, e) > 0.32 || (kin(o.class, e.class) && boxIou(o, e) > 0.2)),
  );
}

function mergeCells(cells: { x: number; y: number; w: number; h: number; score: number }[], minScore: number): Box[] {
  const hot = cells.filter((c) => c.score >= minScore).sort((a, b) => b.score - a.score);
  if (!hot.length) return [];
  const seed = hot[0];
  const scx = seed.x + seed.w / 2;
  const scy = seed.y + seed.h / 2;
  const nearby = hot.filter((c) => {
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    return Math.hypot(cx - scx, cy - scy) <= 0.28;
  });
  let x1 = seed.x;
  let y1 = seed.y;
  let x2 = seed.x + seed.w;
  let y2 = seed.y + seed.h;
  let score = seed.score;
  for (const c of nearby) {
    x1 = Math.min(x1, c.x);
    y1 = Math.min(y1, c.y);
    x2 = Math.max(x2, c.x + c.w);
    y2 = Math.max(y2, c.y + c.h);
    score = Math.max(score, c.score);
  }
  const w = Math.min(0.72, x2 - x1);
  const h = Math.min(0.72, y2 - y1);
  return [{ class: "fish", score: Math.min(0.94, score), x: x1, y: y1, w, h }];
}

async function locateFish(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<Box[]> {
  if (!net) return [];
  const fishBank = prototypes.filter((p) => p.label === "fish");
  const step = 0.3;
  const size = 0.4;
  const cells: { x: number; y: number; w: number; h: number; score: number }[] = [];
  for (let y = 0; y <= 0.6; y += step) {
    for (let x = 0; x <= 0.6; x += step) {
      const box = { x, y, w: size, h: size };
      let score = 0;
      try {
        const cnv = crop(input, x, y, size, size);
        if (fishBank.length) {
          const vec = await embed(cnv);
          if (vec) {
            for (const p of fishBank) score = Math.max(score, cosine(vec, p.vec));
          }
        }
        const preds = await net.classify(cnv, 3);
        for (const p of preds) {
          const name = p.className.toLowerCase();
          if (AQUATIC_LABELS.some((a) => name.includes(a))) score = Math.max(score, 0.35 + p.probability);
        }
      } catch {
        /* skip */
      }
      cells.push({ ...box, score });
    }
  }
  return mergeCells(cells, 0.38);
}

async function secondary(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  existing: Box[],
  filter: FilterId,
): Promise<Box[]> {
  if (!net) return [];
  if (filter !== "all" && filter !== "animals" && filter !== "fish") return [];
  const extra: Box[] = [];

  const fishHits = await locateFish(input);
  extra.push(...fishHits);

  if (!existing.some((e) => e.class === "dog") && filter !== "fish") {
    try {
      const preds = await net.classify(input, 4);
      for (const p of preds) {
        if (/\bdog\b/.test(p.className.toLowerCase()) && p.probability >= 0.2) {
          extra.push({ class: "dog", score: p.probability, x: 0.22, y: 0.22, w: 0.56, h: 0.56 });
        }
      }
    } catch {
      /* ignore */
    }
  }
  return extra;
}

export async function detect(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  opts: { minScore: number; filter: FilterId; seek?: string },
): Promise<Frame> {
  await loadModel();
  if (!coco) throw new Error("detector not ready");
  if (opts.seek !== undefined) seekClass = opts.seek;
  const t0 = performance.now();
  const still = !("videoWidth" in input);
  const { canvas, w, h, cw, ch } = drawWork(input, 640);
  const peekNight = nightInfo(canvas);
  if (peekNight.night) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.filter = "brightness(1.45) contrast(1.12)";
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";
    }
  }
  const pan = still ? { dx: 0, dy: 0 } : stepSlam(canvas);
  tracker.compensate(pan.dx, pan.dy);
  const keep = FILTERS[opts.filter] ?? FILTERS.all;
  const noise = extraFloor() + glareFloor(canvas);
  const floor = (c: string) => {
    if (seekClass && c === seekClass) return 0.12;
    return Math.max(0.12, noise * 0.45);
  };
  let objects: Box[] = [];
  if (yoloReady()) {
    try {
      objects = await detectYolo(input, 0.12);
      setBackend("yolo");
    } catch {
      objects = [];
    }
  }
  const wantCoco = Boolean(coco) && (still || !objects.length);
  if (wantCoco && coco) {
    try {
      const raw: DetectedObject[] = await coco.detect(canvas, 25);
      const extra = raw.map((d) => ({
        class: d.class,
        score: d.score,
        x: d.bbox[0] / cw,
        y: d.bbox[1] / ch,
        w: d.bbox[2] / cw,
        h: d.bbox[3] / ch,
      }));
      objects = objects.length ? objects.concat(novelOnly(extra, objects)) : extra;
      if (!yoloReady()) setBackend("coco-ssd");
      else setBackend("yolo");
    } catch {
      /* keep yolo */
    }
  }
  objects = objects.filter((d) => d.score >= floor(d.class));

  secondaryTick += 1;
  const watchingFish = !watchList.length || watchList.some((c) => isAquaticClass(c));
  const watchingDog = !watchList.length || watchList.includes("dog");
  const needSecondary =
    watchingFish &&
    (opts.filter === "fish" || opts.filter === "animals") &&
    (still || opts.filter === "fish" || objects.filter((o) => isAquaticClass(o.class)).length === 0);
  if (needSecondary && (still || secondaryTick % 3 === 1 || opts.filter === "fish")) {
    const more = await secondary(input, objects, opts.filter);
    objects = objects.concat(more.filter((o) => watchingFish || (watchingDog && o.class === "dog")));
  }

  objects = objects.filter((d) => {
    if (isIgnored(d) || isNegative(d)) return false;
    if (!allowed(d.class, d.name, d.id)) return false;
    if (seekClass && (d.class === seekClass || d.name === seekClass)) return true;
    return keep(d.class) || (opts.filter === "animals" && isAquaticClass(d.class));
  });
  objects = nms(objects);
  objects = pruneBoxes(objects);
  const budget = still ? 14 : 10;
  const stamp = [...objects]
    .sort((a, b) => b.score - a.score || b.w * b.h - a.w * a.h)
    .slice(0, budget);
  for (const o of stamp) {
    try {
      const vec = await embedCrop(input, o);
      if (vec) o.app = vec;
    } catch {
      /* skip */
    }
  }

  const now = performance.now();
  const dt = lastDetectAt ? (now - lastDetectAt) / 1000 : 0.08;
  lastDetectAt = now;
  const tracked: Track[] = tracker.step(objects, dt).filter((t) =>
    t.pinned ||
    t.age > 0 && t.hits >= 3 ||
    (still
      ? t.score >= Math.min(opts.minScore, 0.3) && t.hits >= 1
      : t.hits >= 2 || t.score >= Math.max(opts.minScore, 0.48)),
  );
  const stillMatch = still || Boolean(seekClass) || secondaryTick % 4 === 0;
  const named: Box[] = [];
  const colorBudget = [...tracked]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, still ? 10 : 8);
  const colorSet = new Set(colorBudget);
  const netBudget = still || secondaryTick % 3 === 0
    ? [...tracked].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 8)
    : [];
  const netSet = new Set(netBudget);
  for (const o of tracked) {
    const layer =
      o.y < 0.14 && o.class !== "person" ? "bg" : layerOf(o.class, undefined, o.id) ?? "must";
    const shaped = refineShape(o);
    const { app: _app, gallery: _gal, kx: _kx, ky: _ky, kw: _kw, kh: _kh, challenger: _ch, challengerHits: _chn, ...rest } = o;
    const gal = o.gallery?.length ?? 0;
    const quality = Math.max(
      0.05,
      Math.min(1, o.score * 0.4 + Math.min(1, o.hits / 8) * 0.35 + Math.min(1, gal / 5) * 0.25),
    );
    const stable = o.hits >= 5 && gal >= 2 && o.score >= 0.38;
    let next: Box = enrich({
      ...rest,
      name: shaped,
      kind: shaped || o.class,
      pinned: o.pinned || tracker.isPinned(o.id),
      layer,
      coasting: o.age > 0 && o.hits >= 4,
      quality,
      stable,
      hits: o.hits,
      px: o.x + (o.vx ?? 0) * 0.22,
      py: o.y + (o.vy ?? 0) * 0.22,
    });
    if (colorSet.has(o) || VEHICLES.has(o.class)) {
      try {
        const cnv = crop(input, o.x, o.y, o.w, o.h);
        const color = colorFromCanvas(cnv);
        if (color) next = { ...next, color };
        if (seekColor && color && color !== seekColor && (next.class === seekClass || next.name === seekClass)) {
          next = { ...next, layer: "bg" };
        }
      } catch {
        /* ignore */
      }
    }
    if (net && netSet.has(o)) {
      try {
        const cnv = crop(input, o.x, o.y, o.w, o.h);
        const preds = await net.classify(cnv, 3);
        for (const p of preds) {
          if (p.probability < 0.12) continue;
          const hit = refineFromNet(p.className, o.class);
          if (hit) {
            next = {
              ...next,
              name: hit.name,
              kind: hit.name,
            };
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (o.app) {
      const hit = matchTaught(o.app, 0.36);
      if (hit) next = { ...next, name: hit.name };
    }
    if (stillMatch) {
      try {
        const vec = await embedCrop(input, o);
        const hit = vec ? matchTaught(vec) : null;
        if (hit) {
          next = { ...next, name: hit.name };
        }
      } catch {
        /* ignore */
      }
    }
    named.push(next);
  }
  if (seekClass) {
    const hit = named.find((o) => o.name === seekClass || o.class === seekClass || o.kind === seekClass);
    if (hit?.id != null) {
      seekId = hit.id;
      tracker.pin(hit.id);
      seekHoldUntil = Date.now() + 5000;
    }
  }

  if ((still || secondaryTick % 2 === 0) && named.some((o) => o.class === "person")) {
    try {
      const poses = await estimatePoses(canvas);
      for (const o of named) {
        if (o.class !== "person") continue;
        const hit = matchPose(o, poses);
        if (hit) {
          o.stance = hit.stance;
          o.pose = hit.points;
        }
      }
    } catch {
      /* ignore */
    }
  }
  let faceN = 0;
  if (still || secondaryTick % 3 === 0) {
    try {
      faceN = (await estimateFaces(canvas)).length;
    } catch {
      faceN = 0;
    }
  }
  if ((still || secondaryTick % 8 === 1) && named.length) {
    const cand = [...named].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (cand && cand.w * cand.h > 0.04) {
      try {
        const cnv = crop(input, cand.x, cand.y, cand.w, cand.h);
        const text = await readStencil(cnv);
        if (text) cand.stencil = text;
      } catch {
        /* ignore */
      }
    }
  }
  if ((still || secondaryTick % 3 === 0) && named.some((o) => o.class === "person")) {
    const hs = estimateHands(canvas);
    for (const o of named) {
      if (o.class !== "person") continue;
      const hit = hs.find((h) => h.x >= o.x && h.x <= o.x + o.w && h.y >= o.y && o.y + o.h >= h.y);
      if (hit) o.grasp = { cue: hit.grasp === "pinch" ? "handle" : hit.grasp === "fist" ? "body" : "rim", side: hit.x < o.x + o.w / 2 ? "left" : "right" };
    }
    for (const h of hs) {
      named.push({
        class: "hand",
        name: `hand ${h.grasp}`,
        score: 0.72,
        x: Math.max(0, h.x - 0.05),
        y: Math.max(0, h.y - 0.05),
        w: 0.1,
        h: 0.1,
        grasp: { cue: h.grasp === "pinch" ? "handle" : h.grasp === "fist" ? "body" : "rim", side: h.x < 0.5 ? "left" : "right" },
      });
    }
  }
  const dark = nightInfo(canvas);
  const person = named.find((o) => o.class === "person" && o.h > 0.32);
  if (person) setScaleFromPerson(person.h);
  const scale = metersPerUnit();
  if (scale) {
    for (const o of named) o.meters = Math.round(o.h * scale * 10) / 10;
  }

  const shown = named.filter((o) => allowed(o.class, o.name) && !isIgnored(o));
  const note = backendNote();
  const goal =
    shown.find((o) => matchesSeek(o)) ||
    shown.find((o) => seekClass && (o.class === seekClass || o.name === seekClass));
  const occ = occupancy(
    shown.filter((o) => (o.score ?? 0) >= 0.28),
    goal ? { x: goal.x + goal.w / 2, y: goal.y + goal.h / 2 } : undefined,
    loadHull(),
  );
  if (!still) stampSlam(shown);
  const pathBlock = blocked(shown);
  if (shown.some((o) => o.stance === "fallen")) setFail("fallen", "hold");
  else if (pathBlock) setFail("path blocked", "hold");
  return {
    t: Date.now(),
    w,
    h,
    objects: shown,
    block: pathBlock,
    ms: Math.round(performance.now() - t0),
    seek: seekClass,
    seekId,
    watch: watchList.length ? watchList : undefined,
    color: seekColor,
    backend: note.active,
    occupancy: occ,
    cmc: pan,
    pose: getPose(),
    faces: faceN || undefined,
    night: dark.night || undefined,
    loud: lastSound().score || undefined,
    failsafe: shown.some((o) => o.stance === "fallen") ? "fallen" : pathBlock ? "blocked" : undefined,
    models: {
      primary: note.active,
      secondary: net ? "mobilenet+fish-grid" : "none",
      bank: prototypes.length,
      slot: openVocabSlot(),
    },
  };
}

export function coast(dt: number): Box[] {
  tracker.predict(dt);
  return tracker.snapshot();
}

export function resetTracks(hard = false) {
  tracker.reset(hard);
  resetDepth();
  resetCmc();
  resetSlam();
}

export function mergeTracks(keep: number, drop: number) {
  return tracker.merge(keep, drop);
}

export function pinTrack(id: number) {
  tracker.pin(id);
}

export function unpinTrack(id: number) {
  tracker.unpin(id);
}

export function counts(objects: Box[]) {
  const m = new Map<string, number>();
  for (const o of objects) {
    const k = (o.name || o.class).replace(/^aquatic:/, "").replace(/^fish:/, "fish");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function bearingOf(objects: Box[], cls: string) {
  const hits = objects.filter((o) => o.class === cls);
  if (!hits.length) return null;
  const cx = hits.reduce((s, o) => s + o.x + o.w / 2, 0) / hits.length;
  const side = cx < 0.33 ? "left" : cx > 0.67 ? "right" : "center";
  return { n: hits.length, side, cx };
}
