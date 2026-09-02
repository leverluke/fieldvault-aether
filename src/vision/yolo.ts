import type { GraphModel, Tensor, Tensor1D, Tensor2D, Tensor3D, Tensor4D } from "@tensorflow/tfjs";

const LABELS = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog",
  "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
  "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
  "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
  "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich",
  "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote",
  "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book",
  "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
];

export type YoloBox = { class: string; score: number; x: number; y: number; w: number; h: number };

let net: GraphModel | null = null;
let loadPromise: Promise<GraphModel | null> | null = null;
const SIZE = 640;

export function yoloReady() {
  return Boolean(net);
}

export function loadYolo() {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        net = await tf.loadGraphModel("/models/yolov8n/model.json");
        return net;
      } catch {
        net = null;
        return null;
      }
    })();
  }
  return loadPromise;
}

export async function detectYolo(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  minScore: number,
): Promise<YoloBox[]> {
  const tf = await import("@tensorflow/tfjs");
  if (!net) return [];
  const [h, w] = "videoWidth" in source && source.videoWidth
    ? [source.videoHeight, source.videoWidth]
    : "naturalWidth" in source && source.naturalWidth
      ? [source.naturalHeight, source.naturalWidth]
      : [source.height, source.width];
  if (!w || !h) return [];

  const maxSize = Math.max(w, h);
  const xRatio = maxSize / w;
  const yRatio = maxSize / h;

  tf.engine().startScope();
  try {
    const input = tf.tidy(() => {
      const img = tf.browser.fromPixels(source);
      const padded = img.pad([
        [0, maxSize - h],
        [0, maxSize - w],
        [0, 0],
      ]) as Tensor3D;
      return tf.image.resizeBilinear(padded, [SIZE, SIZE]).div(255).expandDims(0) as Tensor4D;
    });
    const executed = net.execute({ x: input });
    const raw = (Array.isArray(executed) ? executed[0] : executed) as Tensor;
    const trans = raw.transpose([0, 2, 1]);
    const boxes = tf.tidy(() => {
      const bw = trans.slice([0, 0, 2], [-1, -1, 1]);
      const bh = trans.slice([0, 0, 3], [-1, -1, 1]);
      const x1 = tf.sub(trans.slice([0, 0, 0], [-1, -1, 1]), tf.div(bw, 2));
      const y1 = tf.sub(trans.slice([0, 0, 1], [-1, -1, 1]), tf.div(bh, 2));
      return tf.concat([y1, x1, tf.add(y1, bh), tf.add(x1, bw)], 2).squeeze() as Tensor2D;
    });
    const [scores, classes] = tf.tidy(() => {
      const rawScores = trans.slice([0, 0, 4], [-1, -1, LABELS.length]).squeeze([0]);
      return [rawScores.max(1) as Tensor1D, rawScores.argMax(1) as Tensor1D];
    });
    const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 180, 0.48, Math.max(0.08, minScore * 0.45));
    const boxData = boxes.gather(nms, 0).dataSync();
    const scoreData = scores.gather(nms, 0).dataSync();
    const classData = classes.gather(nms, 0).dataSync();
    const out: YoloBox[] = [];
    for (let i = 0; i < scoreData.length; i++) {
      if (scoreData[i] < minScore) continue;
      const y1 = boxData[i * 4] / SIZE;
      const x1 = boxData[i * 4 + 1] / SIZE;
      const y2 = boxData[i * 4 + 2] / SIZE;
      const x2 = boxData[i * 4 + 3] / SIZE;
      const nx = Math.max(0, Math.min(1, x1 * xRatio));
      const ny = Math.max(0, Math.min(1, y1 * yRatio));
      const nw = Math.max(0.01, Math.min(1 - nx, (x2 - x1) * xRatio));
      const nh = Math.max(0.01, Math.min(1 - ny, (y2 - y1) * yRatio));
      const cls = LABELS[classData[i]] || "object";
      out.push({ class: cls, score: scoreData[i], x: nx, y: ny, w: nw, h: nh });
    }
    tf.dispose([raw, trans, boxes, scores, classes, nms, input]);
    return out;
  } catch {
    return [];
  } finally {
    tf.engine().endScope();
  }
}
