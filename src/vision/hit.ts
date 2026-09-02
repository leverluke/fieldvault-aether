/** Map a click on an object-contain canvas to normalized image coords. */
export function canvasNorm(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): { nx: number; ny: number } | null {
  const r = canvas.getBoundingClientRect();
  const cw = canvas.width;
  const ch = canvas.height;
  if (!cw || !ch || !r.width || !r.height) return null;
  const scale = Math.min(r.width / cw, r.height / ch);
  const dw = cw * scale;
  const dh = ch * scale;
  const ox = r.left + (r.width - dw) / 2;
  const oy = r.top + (r.height - dh) / 2;
  const nx = (e.clientX - ox) / dw;
  const ny = (e.clientY - oy) / dh;
  if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return null;
  return { nx, ny };
}
