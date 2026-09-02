import type { BlazeFaceModel, NormalizedFace } from "@tensorflow-models/blazeface";

let model: BlazeFaceModel | null = null;
let loading: Promise<void> | null = null;

export function loadFaces() {
  if (model) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const blaze = await import("@tensorflow-models/blazeface");
      model = await blaze.load({ maxFaces: 8 });
    })().catch(() => {
      loading = null;
    });
  }
  return loading;
}

export async function estimateFaces(canvas: HTMLCanvasElement) {
  if (!model) return [] as { x: number; y: number; w: number; h: number; score: number }[];
  try {
    const hits = (await model.estimateFaces(canvas, false)) as NormalizedFace[];
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    return hits.map((f) => {
      const tl = f.topLeft as [number, number];
      const br = f.bottomRight as [number, number];
      return {
        x: tl[0] / w,
        y: tl[1] / h,
        w: (br[0] - tl[0]) / w,
        h: (br[1] - tl[1]) / h,
        score: Array.isArray(f.probability) ? Number(f.probability[0]) : 0.7,
      };
    });
  } catch {
    return [];
  }
}
