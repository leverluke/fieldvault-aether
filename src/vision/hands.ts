import type { HandLandmarker } from "@mediapipe/tasks-vision";

let hands: HandLandmarker | null = null;
let loading: Promise<void> | null = null;

export function loadHands() {
  if (hands) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      hands = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        numHands: 2,
        runningMode: "IMAGE",
      });
    })().catch(() => {
      loading = null;
    });
  }
  return loading;
}

export type HandHit = {
  x: number;
  y: number;
  grasp: "open" | "pinch" | "fist";
};

export function estimateHands(canvas: HTMLCanvasElement): HandHit[] {
  if (!hands) return [];
  try {
    const res = hands.detect(canvas);
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    return (res.landmarks || []).map((pts) => {
      const wrist = pts[0];
      const thumb = pts[4];
      const index = pts[8];
      const pinch = Math.hypot((thumb.x - index.x) * w, (thumb.y - index.y) * h);
      const span = Math.hypot((pts[8].x - pts[20].x) * w, (pts[8].y - pts[20].y) * h);
      const grasp = pinch < 28 ? "pinch" : span < 40 ? "fist" : "open";
      return { x: wrist.x, y: wrist.y, grasp };
    });
  } catch {
    return [];
  }
}
