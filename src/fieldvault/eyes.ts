import { dHashFromGray, hammingHex, isBlurryVar } from "./format.js";

export type FrameJudge = {
  dark: boolean;
  blur: boolean;
  leakHint: boolean;
  nameplateHint: boolean;
  hash: string;
  laplacian: number;
};

function grayAt(img: CanvasImageSource, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function meanLuma(data: Uint8ClampedArray) {
  let s = 0;
  for (let i = 0; i < data.length; i += 4) s += (data[i] + data[i + 1] + data[i + 2]) / 3;
  return s / (data.length / 4);
}

function laplacianVariance(data: Uint8ClampedArray, w: number, h: number) {
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += v;
      sum2 += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

function rustRatio(data: Uint8ClampedArray) {
  let rust = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    n++;
    if (r > 90 && r > g * 1.25 && r > b * 1.4 && g < 140) rust++;
  }
  return n ? rust / n : 0;
}

function contrastHint(data: Uint8ClampedArray) {
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return max - min;
}

export function judgeImage(img: CanvasImageSource): FrameJudge {
  const small = grayAt(img, 64, 64);
  const hashSrc = grayAt(img, 9, 8);
  if (!small) {
    return { dark: false, blur: false, leakHint: false, nameplateHint: false, hash: "", laplacian: 0 };
  }
  const lap = laplacianVariance(small.data, 64, 64);
  const gray: number[] = [];
  if (hashSrc) {
    for (let i = 0; i < hashSrc.data.length; i += 4) {
      gray.push((hashSrc.data[i] + hashSrc.data[i + 1] + hashSrc.data[i + 2]) / 3);
    }
  }
  return {
    dark: meanLuma(small.data) < 50,
    blur: isBlurryVar(lap),
    leakHint: rustRatio(small.data) > 0.08,
    nameplateHint: contrastHint(small.data) > 90 && lap > 140,
    hash: gray.length ? dHashFromGray(gray, 8) : "",
    laplacian: lap,
  };
}

export async function judgeBlob(blob: Blob): Promise<FrameJudge | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = url;
    });
    return judgeImage(img);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isDuplicateHash(hash: string, prev: string | null | undefined, max = 8) {
  if (!hash || !prev) return false;
  return hammingHex(hash, prev) <= max;
}
