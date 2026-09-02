/** Extra score floor from night (noisy blacks) or glare (blown whites). */
export function glareFloor(canvas: HTMLCanvasElement): number {
  const info = nightInfo(canvas);
  let extra = 0;
  if (info.mean < 0.12) extra += 0.12;
  else if (info.mean < 0.2) extra += 0.06;
  if (info.glare) extra += 0.12;
  if (info.mean > 0.82) extra += 0.08;
  return Math.min(0.2, extra);
}

export function nightInfo(canvas: HTMLCanvasElement): { night: boolean; glare: boolean; mean: number } {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return { night: false, glare: false, mean: 0.5 };
  const w = Math.min(48, canvas.width);
  const h = Math.min(48, canvas.height);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return { night: false, glare: false, mean: 0.5 };
  }
  const px = data.data;
  let sum = 0;
  let hot = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 16) {
    const y = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
    sum += y;
    if (y > 0.92) hot += 1;
    n += 1;
  }
  if (!n) return { night: false, glare: false, mean: 0.5 };
  const mean = sum / n;
  return { night: mean < 0.14, glare: hot / n > 0.16, mean };
}
