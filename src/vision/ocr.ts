let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null = null;
let loading: Promise<void> | null = null;

export function loadOcr() {
  if (worker) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const Tesseract = await import("tesseract.js");
      worker = await Tesseract.createWorker("eng", 1, { logger: () => undefined });
    })().catch(() => {
      loading = null;
    });
  }
  return loading;
}

export async function readStencil(canvas: HTMLCanvasElement): Promise<string | undefined> {
  if (!worker) return undefined;
  try {
    const { data } = await worker.recognize(canvas);
    const text = (data.text || "")
      .toUpperCase()
      .replace(/[^A-Z0-9 \-./]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 2 || text.length > 32) return undefined;
    return text;
  } catch {
    return undefined;
  }
}
