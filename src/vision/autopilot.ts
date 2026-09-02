import { ANIMALS, PEOPLE, VEHICLES, getSeek, getSeekColor, getSeekId, type Frame } from "./detector";
import { pathBlocked, pathYaw } from "./occupancy";
import { findInRoom } from "./room";
import { hullCopy, loadHull, type Hull } from "./hull";
import type { Hunt } from "@/aether/plan";
import { getPose } from "./slam";
import { navTarget } from "./waypoints";

export type Mode = "pad" | "takeoff" | "cruise" | "hold" | "land";

export type CraftState = {
  mode: Mode;
  auto: boolean;
  alt: number;
  spd: number;
  hdg: number;
  x: number;
  y: number;
  yaw: number;
  hull: Hull;
  headingHold: boolean;
  lock?: string;
  hunt?: Hunt;
};

export function idleCraft(): CraftState {
  return {
    mode: "pad",
    auto: true,
    alt: 0,
    spd: 0,
    hdg: 0,
    x: 0,
    y: 0,
    yaw: 0,
    hull: loadHull(),
    headingHold: false,
    hunt: "idle",
  };
}

let lostFrames = 0;
let lostAnnounced = "";
let order: "normal" | "orbit" | "rtl" = "normal";
let standoffM = 0;

export function setStandoffMeters(m: number) {
  standoffM = Math.max(0, m);
}

export function standoffMeters() {
  return standoffM;
}

export function setCraftOrder(next: "normal" | "orbit" | "rtl") {
  order = next;
}

export function craftOrder() {
  return order;
}

export function steer(
  frame: Frame | null,
  hull: Hull = loadHull(),
  headingHold = false,
): { yaw: number; hold: boolean; lock?: string; hunt: Hunt } {
  if (!frame) return { yaw: 0, hold: false, hunt: "idle" };
  const wp = navTarget();
  if (order === "rtl" || wp) {
    const p = getPose();
    const tx = wp?.wx ?? 0;
    const ty = wp?.wy ?? 0;
    const ang = Math.atan2(tx - p.x, ty - p.y) - p.yaw;
    let yaw = ang * 16;
    while (yaw > 18) yaw -= 36;
    while (yaw < -18) yaw += 36;
    const noWay = pathBlocked(frame.occupancy);
    if (noWay) return { yaw: 0, hold: true, hunt: "failsafe", lock: "blocked" };
    return { yaw, hold: Math.hypot(tx - p.x, ty - p.y) < 0.15, hunt: "rtl", lock: wp?.name || "home" };
  }
  if (hull === "water") return steerWater(frame, headingHold);
  return steerAir(frame);
}

function steerAir(frame: Frame): { yaw: number; hold: boolean; lock?: string; hunt: Hunt } {
  const seek = frame.seek || getSeek();
  const wantId = frame.seekId ?? getSeekId();
  const wantColor = frame.color || getSeekColor();
  const path = frame.occupancy?.path;
  const occYaw = path && path.length > 1 ? pathYaw(path) : 0;
  const noWay = pathBlocked(frame.occupancy);

  if (seek || wantId != null) {
    const hits = frame.objects.filter((o) => {
      if (wantId != null) return o.id === wantId;
      const cls = o.class === seek || o.name === seek;
      if (!cls) return false;
      if (wantColor && o.color && o.color !== wantColor) return false;
      return true;
    });
    if (hits.length) {
      lostFrames = 0;
      const o = hits.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
      const cx = o.x + o.w / 2;
      const centered = cx > 0.38 && cx < 0.62;
      if (order === "orbit" || standoffM) {
        const far = standoffM && o.meters != null ? o.meters > standoffM * 1.15 : o.range !== "near";
        const close = standoffM && o.meters != null ? o.meters <= standoffM : o.range === "near";
        return {
          yaw: close ? 3 : far ? 10 : 6,
          hold: close,
          lock: `#${o.id} hold ${standoffM ? standoffM + "m" : "near"}`,
          hunt: close ? "locked" : "orbit",
        };
      }
      const yaw = centered ? occYaw : (0.5 - cx) * 28 + occYaw;
      const locked = centered && (o.range === "near" || (o.range === "mid" && o.depth === "closing"));
      const hold = locked || noWay;
      const tag = wantId != null ? `#${wantId}` : o.name || o.class;
      return {
        yaw: noWay ? 0 : yaw,
        hold,
        lock: `${tag} ${o.bearing} ${o.range}${o.depth ? " " + o.depth : ""}`,
        hunt: noWay ? "failsafe" : locked ? "locked" : "approaching",
      };
    }
    lostFrames += 1;
    if (lostFrames > 20) {
      return { yaw: 0, hold: true, lock: "failsafe hold", hunt: "failsafe" };
    }
    const mem = seek ? findInRoom(seek)[0] : undefined;
    const yaw = noWay ? 0 : mem ? (0.5 - mem.x) * 24 + occYaw : occYaw;
    return {
      yaw,
      hold: noWay,
      lock: mem ? `last seen ${mem.bearing || (mem.x < 0.33 ? "left" : mem.x > 0.67 ? "right" : "ahead")}` : `lost ${seek || "#" + wantId}`,
      hunt: "lost",
    };
  }
  const threats = frame.objects.filter((o) => {
    const c = o.class;
    const threat =
      PEOPLE.has(c) ||
      VEHICLES.has(c) ||
      ANIMALS.has(c) ||
      c === "fish" ||
      c.startsWith("aquatic:") ||
      c.startsWith("fish:");
    return threat && o.score >= 0.4;
  });
  let left = 0;
  let mid = 0;
  let right = 0;
  for (const o of threats) {
    const cx = o.x + o.w / 2;
    if (cx < 0.33) left += 1;
    else if (cx > 0.67) right += 1;
    else mid += 1;
  }
  const hold = frame.block || mid > 0 || noWay;
  let yaw = occYaw;
  if (!hold && !path?.length) {
    if (left > right) yaw = 18;
    else if (right > left) yaw = -18;
  }
  return { yaw, hold, hunt: "idle" };
}

function steerWater(frame: Frame, headingHold: boolean): { yaw: number; hold: boolean; lock?: string; hunt: Hunt } {
  const occ = frame.occupancy;
  const path = occ?.path;
  const occYaw = path && path.length > 1 ? pathYaw(path) : 0;
  const ch = occ?.channel || "clear";
  const bow = Boolean(occ?.bowBlocked);
  const seek = headingHold ? undefined : frame.seek || getSeek();
  const wantId = headingHold ? undefined : frame.seekId ?? getSeekId();

  const nearBow = frame.objects.some((o) => {
    if (!WATER_NEAR.has(o.class)) return false;
    const cx = o.x + o.w / 2;
    return o.range === "near" && cx > 0.32 && cx < 0.68;
  });

  if (seek || wantId != null) {
    const hits = frame.objects.filter((o) => (wantId != null ? o.id === wantId : o.class === seek || o.name === seek));
    if (hits.length) {
      const o = hits.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
      const cx = o.x + o.w / 2;
      const centered = cx > 0.4 && cx < 0.6;
      let yaw = (0.5 - cx) * 18 + occYaw * 0.8;
      if (ch === "port") yaw += 10;
      if (ch === "starboard") yaw -= 10;
      const locked = centered && o.range === "near";
      return {
        yaw: clampYaw(yaw * 0.65),
        hold: locked || nearBow,
        lock: `${o.name || o.class} · ${ch}`,
        hunt: locked ? "locked" : "approaching",
      };
    }
  }

  let yaw = occYaw;
  if (ch === "port") yaw = Math.max(yaw, 16);
  else if (ch === "starboard") yaw = Math.min(yaw, -16);
  else if (ch === "blocked") yaw = 0;
  const hold = nearBow || ch === "blocked" || bow;
  return {
    yaw: hold ? 0 : clampYaw(yaw * 0.55),
    hold,
    lock: hold ? `hazard ${ch}` : `channel ${ch}`,
    hunt: hold ? "locked" : "idle",
  };
}

const WATER_NEAR = new Set(["person", "boat", "car", "truck", "bus", "bird", "dog"]);

function clampYaw(n: number) {
  return Math.max(-22, Math.min(22, n));
}

export function lostKey() {
  return lostAnnounced;
}

export function markLost(k: string) {
  lostAnnounced = k;
}

export function step(state: CraftState, dt: number, desire: { yaw: number; hold: boolean; lock?: string; hunt?: Hunt }): CraftState {
  const next = { ...state, lock: desire.lock, hunt: desire.hunt };
  const copy = hullCopy(next.hull);
  if (next.mode === "takeoff") {
    if (copy.usesAlt) {
      next.alt = Math.min(copy.cruiseAlt, next.alt + 6 * dt);
      if (next.alt >= copy.cruiseAlt) next.mode = next.auto ? (desire.hold ? "hold" : "cruise") : "hold";
    } else {
      next.spd = Math.min(3, next.spd + 8 * dt);
      next.mode = next.auto ? (desire.hold ? "hold" : "cruise") : "hold";
    }
  }
  if (next.mode === "land") {
    next.spd = Math.max(0, next.spd - 8 * dt);
    if (copy.usesAlt) next.alt = Math.max(0, next.alt - 5 * dt);
    if (next.spd <= 0.2 && (!copy.usesAlt || next.alt <= 0)) {
      next.alt = 0;
      next.spd = 0;
      next.mode = "pad";
    }
  }
  if (next.mode === "hold") {
    next.spd = Math.max(0, next.spd - 10 * dt);
    const canGo = copy.usesAlt ? next.alt > 8 : true;
    if (next.auto && !desire.hold && canGo && desire.hunt !== "locked") next.mode = "cruise";
  }
  if (next.mode === "cruise") {
    if (next.auto && desire.hold) next.mode = "hold";
    else {
      const water = next.hull === "water";
      const closing = desire.lock?.includes("closing");
      const receding = desire.lock?.includes("receding");
      const cap = water ? (desire.hold ? 1.2 : 4.2) : receding ? 5 : closing ? 9 : 8;
      const accel = water ? 1.6 : receding ? 1 : 4;
      next.spd = Math.min(cap, next.spd + accel * dt);
      const gain = water ? 0.42 : 1;
      next.hdg = (next.hdg + desire.yaw * dt * gain + 360) % 360;
    }
  }
  const rad = (next.hdg * Math.PI) / 180;
  next.x += Math.sin(rad) * next.spd * dt;
  next.y += Math.cos(rad) * next.spd * dt;
  next.yaw = desire.yaw;
  return next;
}
