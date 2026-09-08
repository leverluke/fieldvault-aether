import { parseNameplateText } from "./format.js";

export async function readNameplate(source: Blob | HTMLCanvasElement) {
  try {
    const { loadOcr, readStencil } = await import("@/vision/ocr");
    await loadOcr();
    let canvas: HTMLCanvasElement;
    if (source instanceof HTMLCanvasElement) {
      canvas = source;
    } else {
      const url = URL.createObjectURL(source);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("ocr-image"));
          el.src = url;
        });
        canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const stencil = await readStencil(canvas);
    if (stencil) return parseNameplateText(stencil);
    const Tesseract = await import("tesseract.js");
    const { data } = await Tesseract.recognize(canvas, "eng");
    return parseNameplateText(data.text || "");
  } catch {
    return {};
  }
}
