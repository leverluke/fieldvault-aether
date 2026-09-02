import { speak } from "@/aether/speech";
import type { Frame } from "./detector";
import { findInRoom } from "./room";
import { chime } from "./chime";

let lastLock = "";
let lastLost = "";
let muted = true;
let lastSpeak = 0;
let quietWatch = true;
let seenIds = new Set<number>();

export function setCallouts(on: boolean) {
  muted = !on;
}

export function calloutsOn() {
  return !muted;
}

export function setQuietWatch(on: boolean) {
  quietWatch = on;
}

export function announceFrame(frame: Frame, hunt?: string) {
  if (muted) return;
  const now = Date.now();
  if (frame.night && now - lastSpeak > 8000) {
    lastSpeak = now;
    speak("I need light.", false);
    return;
  }
  if (frame.failsafe === "fallen" && now - lastSpeak > 4000) {
    lastSpeak = now;
    chime();
    speak("Fallen.", false);
    return;
  }
  if (quietWatch) {
    for (const o of frame.objects) {
      if (o.id == null || seenIds.has(o.id) || o.layer === "bg") continue;
      if (o.hits && o.hits < 3) continue;
      seenIds.add(o.id);
      if (now - lastSpeak < 2000) continue;
      lastSpeak = now;
      speak(`${o.name || o.class} ${o.id}.`, false);
      return;
    }
  }
  if (now - lastSpeak < 2800) return;

  if (frame.seek && hunt === "lost") {
    if (lastLost !== frame.seek) {
      lastLost = frame.seek;
      lastSpeak = now;
      const mem = findInRoom(frame.seek)[0];
      speak(mem ? "Lost." : "Lost. Hunting.", false);
    }
    return;
  }

  if (frame.seek) {
    const hits = frame.objects.filter(
      (o) =>
        (o.class === frame.seek || o.name === frame.seek) &&
        (!frame.color || !o.color || o.color === frame.color),
    );
    if (hits.length) {
      lastLost = "";
      const o = hits[0];
      const lock = `${frame.seek}:${hunt || ""}`;
      if (hunt === "locked" && lastLock !== lock) {
        lastLock = lock;
        lastSpeak = now;
        chime();
        speak("Locked.", false);
        return;
      }
      if (hunt === "approaching" && o.range === "near" && lastLock !== lock) {
        lastLock = lock;
        lastSpeak = now;
        speak("Near.", false);
      }
    }
  }
}

export function resetAnnounced() {
  lastLock = "";
  lastLost = "";
  seenIds = new Set();
}
