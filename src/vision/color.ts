export type ColorName = "black" | "white" | "gray" | "red" | "orange" | "yellow" | "green" | "blue" | "brown";

const NAMES: ColorName[] = ["black", "white", "gray", "red", "orange", "yellow", "green", "blue", "brown"];

export function parseColor(q: string): ColorName | undefined {
  const m = q.toLowerCase().match(/\b(black|white|gray|grey|silver|red|orange|yellow|green|blue|brown)\b/);
  if (!m) return undefined;
  const w = m[1];
  if (w === "grey" || w === "silver") return "gray";
  return w as ColorName;
}

function hueName(h: number, s: number, v: number): ColorName {
  if (v < 0.14) return "black";
  if (s < 0.14) return v > 0.78 ? "white" : "gray";
  if (h < 18 || h >= 345) return "red";
  if (h < 40) return s < 0.45 && v < 0.55 ? "brown" : "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 265) return "blue";
  if (h < 325) return v < 0.45 ? "brown" : "red";
  return "red";
}

function rgbToHsv(r: number, g: number, b: number) {
  const m0 = Math.max(r, g, b);
  const m1 = Math.min(r, g, b);
  const d = m0 - m1;
  let h = 0;
  if (d > 0.001) {
    if (m0 === r) h = ((g - b) / d) % 6;
    else if (m0 === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: m0 ? d / m0 : 0, v: m0 };
}

export function colorFromCanvas(canvas: HTMLCanvasElement): ColorName | undefined {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  const { width, height } = canvas;
  if (!width || !height) return undefined;
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, width, height);
  } catch {
    return undefined;
  }
  const tally: Record<ColorName, number> = {
    black: 0,
    white: 0,
    gray: 0,
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    blue: 0,
    brown: 0,
  };
  const px = data.data;
  let n = 0;
  for (let i = 0; i < px.length; i += 16) {
    const a = px[i + 3];
    if (a < 40) continue;
    const { h, s, v } = rgbToHsv(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    tally[hueName(h, s, v)] += 1;
    n += 1;
  }
  if (n < 8) return undefined;
  let best: ColorName = "gray";
  let max = 0;
  for (const name of NAMES) {
    if (tally[name] > max) {
      max = tally[name];
      best = name;
    }
  }
  return max / n < 0.28 ? undefined : best;
}
