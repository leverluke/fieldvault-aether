import type { FilterId, Frame } from "@/vision/detector";
import { tickWatchers } from "./brain/watchers";
import { parseSeek, parseWatch } from "@/vision/classes";
import { describeMemory, findInRoom } from "@/vision/room";

const KEY = "aether:pending";

export type Cmd = {
  type: string;
  body?: string;
  on?: boolean;
  id?: string;
};

let lastFrame: Frame | null = null;

export function publishFrame(frame: Frame) {
  lastFrame = frame;
  try {
    tickWatchers(frame);
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("aether:see", { detail: frame }));
}

export function getLastFrame(): Frame | null {
  return lastFrame;
}

export function sendCmd(detail: Cmd) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("aether:cmd", { detail }));
  try {
    sessionStorage.setItem(KEY, JSON.stringify(detail));
  } catch {
    /* ignore */
  }
}

export function takePending(): Cmd | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as Cmd;
  } catch {
    return null;
  }
}

export function describeFrame(frame: Frame | null): string {
  if (!frame) return "I don't have a frame yet. Open my eyes and start the camera, or drop a photo.";
  const tally = new Map<string, number>();
  for (const o of frame.objects) tally.set(o.class, (tally.get(o.class) ?? 0) + 1);
  const list = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => (n === 1 ? `1 ${c}` : `${n} ${c}s`))
    .join(", ");
  const path = frame.block ? "Path blocked." : "Path clear.";
  const lock = frame.objects.filter((o) => o.stable).length;
  const q = frame.objects[0]?.quality;
  const fallen = frame.objects.filter((o) => o.stance === "fallen").length;
  const hands = frame.objects.filter((o) => o.grasp).length;
  const extra =
    (lock ? ` ${lock} locked IDs.` : q != null ? ` Top quality ${Math.round(q * 100)}.` : "") +
    (fallen ? ` ${fallen} fallen.` : "") +
    (frame.faces ? ` ${frame.faces} faces.` : "") +
    (hands ? ` ${hands} grasp cues.` : "");
  if (frame.seek) {
    const hits = frame.objects.filter((o) => o.class === frame.seek || o.name === frame.seek);
    if (!hits.length) {
      const mem = findInRoom(frame.seek);
      if (mem.length) return `${path} No ${frame.seek} in frame. ${describeMemory(mem[0])}.${extra}`;
      return `${path} No ${frame.seek} in frame. I do see: ${list || "nothing labeled"}.${extra}`;
    }
    const o = hits[0];
    const who = [o.color, o.name || frame.seek].filter(Boolean).join(" ");
    const grasp = o.grasp ? ` Grasp ${o.grasp.cue}.` : "";
    const depth = o.depth ? ` ${o.depth}.` : "";
    return `${path} ${hits.length} ${who} ${o.bearing}, ${o.range}.${depth}${grasp} Scene: ${list}.${extra}`;
  }
  if (!list) return `${path} Nothing above the threshold.`;
  return `${path} ${list}.${extra}`;
}

export function parseSeeFilter(q: string): FilterId | undefined {
  if (/\bpeople|person\b/.test(q)) return "people";
  if (/\b(dog|cat|animal|bird|horse|livestock)\b/.test(q)) return "animals";
  if (/\bfish|shark|aquatic\b/.test(q)) return "fish";
  if (/\b(furniture|room|scene|things|household|background)\b/.test(q)) return "scene";
  if (/\bvehicle|cars?|trucks?\b/.test(q)) return "vehicles";
  if (/\btraffic\b/.test(q)) return "traffic";
  if (/\ball\b/.test(q)) return "all";
  return undefined;
}

export { parseSeek, parseWatch };
