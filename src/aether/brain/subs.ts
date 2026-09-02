import { parseIntent } from "../nlu";
import { runAssistant } from "../assistant";
import { clock, parseDuration, timeAt, weather } from "../tools";
import { chartPack, cocoExport, fieldVaultRow, geoJsonExport, zipPack } from "@/vision/pack";
import { describePose } from "@/vision/slam";
import { inventory } from "@/vision/room";
import { addWaypoint, homeOf, setNavTarget } from "@/vision/waypoints";
import { getPose } from "@/vision/slam";
import { getLastFrame } from "../bus";
import { runMemory } from "./memoryAgent";
import { worldQa } from "./qa";
import type { AgentId } from "./bank";
import type { Ctx, Reply } from "../types";

export async function runSub(agent: AgentId, q: string, _ctx: Ctx): Promise<Reply | null> {
  if (agent === "memory" || agent === "watch") return runMemory(q);
  if (agent === "time") return runTime(q);
  if (agent === "weather") return runWeather(q);
  if (agent === "export") return runExport(q);
  if (agent === "safety") return runSafety(q);
  if (agent === "map") return runMap(q);
  if (agent === "comms" || agent === "nav" || agent === "life") {
    const assisted = await runAssistant(parseIntent(q));
    return assisted;
  }
  return null;
}

async function runTime(q: string): Promise<Reply> {
  if (/^what time|^time$|what.?s the time|current time/.test(q) && !/\bin\b/.test(q)) {
    return { text: clock(), ran: "time" };
  }
  const inPlace = q.match(/(?:time in|what time is it in) (.+)/)?.[1];
  if (inPlace) {
    try {
      return { text: await timeAt(inPlace), ran: "time" };
    } catch {
      return { text: `I could not get the time in ${inPlace}.`, ran: "time" };
    }
  }
  const dur = parseDuration(q);
  if (dur && /\b(remind|timer|in \d)\b/.test(q)) {
    const label = q.replace(/remind me (to )?/, "").trim() || "Timer";
    return { text: `Timer ${dur}s. ${label}`, ran: "time", timerSec: dur, timerLabel: label, speak: "Timer set." };
  }
  const assisted = await runAssistant(parseIntent(q));
  return assisted || { text: clock(), ran: "time" };
}

async function runWeather(q: string): Promise<Reply> {
  const place = q.match(/(?:weather|forecast|temperature|sunrise|sunset)(?: in| for| at)? (.+)/)?.[1] || "Lima Ohio";
  try {
    const w = await weather(place.replace(/\b(like|please)\b/g, "").trim());
    return { text: w.line, ran: "weather" };
  } catch {
    return { text: "Weather is unreachable.", ran: "weather" };
  }
}

async function runExport(q: string): Promise<Reply> {
  if (/coco/.test(q)) {
    cocoExport();
    return { text: "COCO JSON downloaded.", ran: "export" };
  }
  if (/geojson/.test(q)) {
    geoJsonExport();
    return { text: "GeoJSON downloaded.", ran: "export" };
  }
  if (/fieldvault/.test(q)) {
    fieldVaultRow();
    return { text: "FieldVault row downloaded.", ran: "export" };
  }
  const p = await zipPack();
  return { text: `Zip pack saved. Hash ${p.hash.slice(0, 12)}.`, ran: "export" };
}

function runSafety(q: string): Reply {
  const qa = worldQa(q);
  if (qa) return { ...qa, ran: "safety" };
  const frame = getLastFrame();
  if (/\bfallen|anyone down\b/.test(q)) {
    const n = (frame?.objects || []).filter((o) => o.stance === "fallen").length;
    const text = n ? `${n} fallen.` : "No fallen pose in frame.";
    return { text, speak: text, ran: "safety" };
  }
  return { text: frame?.block ? "Path blocked." : frame ? "Path clear." : "No frame.", ran: "safety" };
}

function runMap(q: string): Reply {
  if (/\bset home\b/.test(q)) {
    const p = getPose();
    addWaypoint("home", p.x, p.y, "home");
    return { text: "Home is this pose.", ran: "map" };
  }
  if (/\bwaypoint\b/.test(q)) {
    const p = getPose();
    addWaypoint("wp", p.x, p.y);
    const h = homeOf();
    if (/go to|navigate/.test(q) && h) {
      setNavTarget(h.wx, h.wy, h.name);
      return { text: `Going to ${h.name}.`, ran: "map" };
    }
    return { text: "Waypoint dropped.", ran: "map" };
  }
  if (/\bheading|where am i|how far\b/.test(q)) {
    const text = describePose();
    return { text, speak: text, ran: "map" };
  }
  const text = `${inventory()} ${describePose()}`;
  return { text, speak: text, ran: "map" };
}
