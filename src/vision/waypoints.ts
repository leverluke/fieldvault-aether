const KEY = "aether:wp";

export type Waypoint = {
  id: string;
  name: string;
  wx: number;
  wy: number;
  kind: "wp" | "home" | "nogo";
};

let wps: Waypoint[] = [];

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function load() {
  if (typeof window === "undefined") return;
  try {
    wps = JSON.parse(localStorage.getItem(KEY) || "[]") as Waypoint[];
  } catch {
    wps = [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(wps));
  } catch {
    /* ignore */
  }
}

load();

export function listWaypoints() {
  return wps;
}

export function addWaypoint(name: string, wx: number, wy: number, kind: Waypoint["kind"] = "wp") {
  const row: Waypoint = { id: uid(), name: name.trim() || "wp", wx, wy, kind };
  if (kind === "home") wps = wps.filter((w) => w.kind !== "home");
  wps.push(row);
  save();
  return row;
}

export function homeOf() {
  return wps.find((w) => w.kind === "home");
}

export function findWaypoint(q: string) {
  const n = q.toLowerCase();
  return wps.find((w) => w.name.toLowerCase() === n || w.name.toLowerCase().includes(n));
}

export function clearWaypoints() {
  wps = [];
  save();
}

let meters = 0;

export function setScale(metersPerUnit: number) {
  meters = metersPerUnit;
  try {
    localStorage.setItem("aether:scale", String(meters));
  } catch {
    /* ignore */
  }
}

export function metersPerUnit() {
  if (meters) return meters;
  try {
    meters = Number(localStorage.getItem("aether:scale") || 0);
  } catch {
    meters = 0;
  }
  return meters;
}

export function setScaleFromPerson(boxH: number) {
  if (boxH < 0.2 || metersPerUnit()) return 0;
  const m = 1.7 / boxH;
  setScale(m);
  return m;
}

export function setScaleFromDoor(boxH: number, inches = 36) {
  if (boxH <= 0.02) return 0;
  const m = (inches * 0.0254) / boxH;
  setScale(m);
  return m;
}

let nav: { wx: number; wy: number; name: string } | null = null;

export function setNavTarget(wx: number, wy: number, name: string) {
  nav = { wx, wy, name };
}

export function navTarget() {
  return nav;
}

export function clearNav() {
  nav = null;
}
