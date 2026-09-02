/** Slot for YOLO-World / custom class head. No weights in this tab. */

let ready = false;
let tried = false;

export async function loadOpenVocab() {
  if (tried) return ready;
  tried = true;
  try {
    const res = await fetch("/models/yolo-world/model.json", { method: "HEAD" });
    ready = res.ok;
  } catch {
    ready = false;
  }
  return ready;
}

export function openVocabReady() {
  return ready;
}

export function openVocabSlot() {
  return ready ? "yolo-world" : "browser-coco (no open-vocab weights)";
}
