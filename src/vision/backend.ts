/** Primary detector slot. Tracker / IDs / seek stay the same if YOLO replaces COCO. */
export type BackendName = "coco-ssd" | "yolo";

let active: BackendName = "coco-ssd";

export function getBackend(): BackendName {
  return active;
}

export function setBackend(name: BackendName) {
  active = name;
  try {
    localStorage.setItem("aether:backend", name);
  } catch {
    /* ignore */
  }
}

export function backendNote() {
  return {
    active: getBackend(),
    slot: "yolo" as const,
    ready: getBackend() === "yolo",
    detail:
      getBackend() === "yolo"
        ? "YOLOv8n + ByteTrack + Kalman. Sketch is 2D visual SLAM-lite."
        : "COCO-SSD active. YOLOv8n loading or unavailable — same tracker either way.",
  };
}
