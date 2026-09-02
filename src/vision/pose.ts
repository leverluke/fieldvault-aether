import type { PoseDetector, Pose } from "@tensorflow-models/pose-detection";

export type Stance = "standing" | "sitting" | "fallen" | "unknown";

export type PersonPose = {
  stance: Stance
  score: number
  points: { name: string; x: number; y: number; score: number }[];
};

let det: PoseDetector | null = null;
let loading: Promise<void> | null = null;

export function poseReady() {
  return Boolean(det);
}

export function loadPose() {
  if (det) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const posedetection = await import("@tensorflow-models/pose-detection");
      det = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
    })().catch(() => {
      loading = null;
    });
  }
  return loading;
}

function kp(pose: Pose, name: string) {
  return pose.keypoints.find((k) => k.name === name);
}

function stanceOf(pose: Pose): Stance {
  const ls = kp(pose, "left_shoulder");
  const rs = kp(pose, "right_shoulder");
  const lh = kp(pose, "left_hip");
  const rh = kp(pose, "right_hip");
  const lk = kp(pose, "left_knee");
  const rk = kp(pose, "right_knee");
  const sh = ls && rs ? (ls.y + rs.y) / 2 : undefined;
  const hip = lh && rh ? (lh.y + rh.y) / 2 : undefined;
  const knee = lk && rk ? (lk.y + rk.y) / 2 : undefined;
  if (sh != null && hip != null) {
    const torso = Math.abs(hip - sh);
    const wide = Math.abs((ls?.x ?? 0) - (rs?.x ?? 0));
    if (torso < wide * 0.35 && torso < 40) return "fallen";
    if (knee != null && Math.abs(knee - hip) < torso * 0.55) return "sitting";
    if (hip > sh + 18) return "standing";
  }
  return "unknown";
}

export async function estimatePoses(
  canvas: HTMLCanvasElement,
): Promise<PersonPose[]> {
  if (!det) return [];
  try {
    const poses = await det.estimatePoses(canvas, { maxPoses: 8, flipHorizontal: false });
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    return poses.map((p) => ({
      stance: stanceOf(p),
      score: p.score ?? 0,
      points: p.keypoints
        .filter((k) => (k.score ?? 0) > 0.25)
        .map((k) => ({
          name: k.name || "",
          x: k.x / w,
          y: k.y / h,
          score: k.score ?? 0,
        })),
    }));
  } catch {
    return [];
  }
}

export function matchPose(
  box: { x: number; y: number; w: number; h: number },
  poses: PersonPose[],
): PersonPose | undefined {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let best: { p: PersonPose; d: number } | null = null;
  for (const p of poses) {
    const nose = p.points.find((k) => k.name === "nose") || p.points[0];
    if (!nose) continue;
    if (nose.x < box.x - 0.05 || nose.x > box.x + box.w + 0.05) continue;
    const d = Math.hypot(nose.x - cx, nose.y - cy);
    if (!best || d < best.d) best = { p, d };
  }
  return best && best.d < 0.45 ? best.p : undefined;
}
