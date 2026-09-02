import { getLastFrame } from "../bus";
import { loadAgenda, loadLastPlace, loadList, loadNotes, loadReservations, loadTasks, nextAgenda } from "../memory";
import { getPose } from "@/vision/slam";
import { loadHull } from "@/vision/hull";
import { taughtList } from "@/vision/teach";
import { listWaypoints } from "@/vision/waypoints";
import { lastSound } from "@/vision/yamnet";
import type { Frame } from "@/vision/detector";

export type Trace = { t: number; q: string; agent: string; score: number };

export type World = {
  t: number;
  frame: Frame | null;
  objects: string[];
  seek?: string;
  pose: { x: number; y: number; yaw: number };
  hull: string;
  sound: string;
  lastPlace?: string;
  next?: string;
  openTasks: number;
  list: number;
  notes: number;
  taught: number;
  waypoints: number;
};

let last: { entity?: string; agent?: string; seek?: string; place?: string; object?: string; contact?: string } = {};
const traces: Trace[] = [];

export function snapshot(): World {
  const frame = getLastFrame();
  const objs = frame?.objects.filter((o) => o.layer !== "bg").map((o) => o.name || o.class) || [];
  const nxt = nextAgenda();
  return {
    t: Date.now(),
    frame,
    objects: objs,
    seek: frame?.seek,
    pose: getPose(),
    hull: loadHull(),
    sound: lastSound().label,
    lastPlace: loadLastPlace()?.name,
    next: nxt ? `${nxt.title}${nxt.whenLabel ? ` ${nxt.whenLabel}` : ""}` : undefined,
    openTasks: loadTasks().filter((t) => !t.done).length,
    list: loadList().filter((i) => !i.done).length,
    notes: loadNotes().length,
    taught: taughtList().length,
    waypoints: listWaypoints().length,
  };
}

export function remember(partial: typeof last) {
  last = { ...last, ...partial };
}

export function recall() {
  return last;
}

export function pushTrace(row: Trace) {
  traces.unshift(row);
  if (traces.length > 24) traces.pop();
  last = { ...last, agent: row.agent };
  try {
    localStorage.setItem("aether:last-agent", row.agent);
  } catch {
    /* ignore */
  }
}

export function brainTrace() {
  if (!traces.length && typeof window !== "undefined") {
    try {
      const a = localStorage.getItem("aether:last-agent");
      if (a) traces.push({ t: Date.now(), q: "", agent: a, score: 1 });
    } catch {
      /* ignore */
    }
  }
  return traces;
}

export function describeWorld(w = snapshot()) {
  const see = w.objects.length ? `Eyes: ${w.objects.slice(0, 8).join(", ")}.` : "Eyes dark.";
  const next = w.next ? `Next: ${w.next}.` : "";
  const place = w.lastPlace ? `Last place ${w.lastPlace}.` : "";
  return `${see} ${w.hull} hull. ${next} ${place}`.replace(/\s+/g, " ").trim();
}
