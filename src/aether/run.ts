import { BODIES } from "@/space/bodies";
import { WORK } from "@/data/catalog";
import { runAssistant } from "./assistant";
import { parseIntent } from "./nlu";
import {
  addNote,
  addTask,
  clearNotes,
  completeTask,
  loadList,
  loadNotes,
  loadReservations,
  loadTasks,
  nextAgenda,
  persistTimers,
  timers,
} from "./memory";
import {
  calc,
  clock,
  define,
  here,
  issNow,
  parseDuration,
  timeAt,
  weather,
  wiki,
} from "./tools";
import type { Ctx, Reply } from "./types";

export type { Reply, Action, Ctx } from "./types";

const HELP = `Cortex — 14 subagents. Close scores run together (brief + eyes).

life · comms · nav — book, call, text, directions. You talk to the host.
eyes · map · safety — see, sketch, fallen, path.
craft — air, water, or ground.
memory · watch · time · weather · export · brief · help

“tell me when you see a dog”, “run morning”, “remember the gate code is 4455”. Paste a still.

I can't place a carrier call from a desktop tab with no account. Twilio in Calling to ring you first. Optional xAI key for fuzzy tool-calling.`;

function strip(s: string) {
  return s
    .toLowerCase()
    .replace(/[?.!,]/g, " ")
    .replace(/\b(please|hey|aether|ok|okay|can you|could you|would you|i want you to|go ahead and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function after(s: string, re: RegExp) {
  const m = s.match(re);
  return m?.[1]?.trim() || "";
}

import { sendCmd, describeFrame, getLastFrame, parseSeek, parseWatch } from "./bus";
import { describePlan, parsePlan, startPlan, kickStep, skipPlan } from "./plan";
import { setSeek, setSeekId, setWatch } from "@/vision/detector";
import { hullCopy } from "@/vision/hull";
import { parseColor } from "@/vision/color";
import { inventory, whereIs } from "@/vision/room";
import { describePose, getPose } from "@/vision/slam";
import { addWaypoint, findWaypoint, homeOf, setNavTarget, setScaleFromDoor } from "@/vision/waypoints";
import { addFence } from "./geo";
import { chartPack, cocoExport, fieldVaultRow, fieldVaultWalk, geoJsonExport, zipPack } from "@/vision/pack";
import { logAction, undoLast, setPending, takePending, hasPending, setQuiet, quietHours } from "./log";
import { rewrite, ingestReply } from "./brain/context";
import { startFollowMe } from "./follow";
import { downloadMavlink } from "@/vision/mavlink";
import { importFieldVault } from "./importfv";
import { llmKey, tryLlm } from "./llm";
import { setFail, failLine } from "./fail";
import { joinMesh } from "@/vision/mesh";
import { setCraftOrder } from "@/vision/autopilot";
import { think, describeWorld } from "./brain";
import { worldQa } from "./brain/qa";
import { runMemory, getRoutine } from "./brain/memoryAgent";
import { runSub } from "./brain/subs";
import { canonicalClass } from "@/vision/classes";
import { taughtList } from "@/vision/teach";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureSee(ctx: Ctx) {
  if (
    ctx.pathname.includes("/aether/see") ||
    ctx.pathname.includes("/aether/craft") ||
    ctx.pathname.includes("/lookout")
  ) {
    return;
  }
  ctx.navigate("/apps/aether/see");
  await sleep(450);
}

async function ensureCraft(ctx: Ctx) {
  if (!ctx.pathname.includes("/aether/craft")) {
    ctx.navigate("/apps/aether/craft");
    await sleep(450);
  }
}

async function ensurePlay(ctx: Ctx) {
  if (!ctx.pathname.includes("/empty-stretch/play")) {
    ctx.navigate("/apps/empty-stretch/play");
    await sleep(450);
  }
}

function bodyFrom(text: string) {
  const t = text.toLowerCase();
  const aliases: Record<string, string> = {
    "pale blue dot": "pbd",
    pbd: "pbd",
    voyager: "voyager1",
    "voyager 1": "voyager1",
    heliopause: "heliopause",
    "the sun": "sun",
  };
  for (const [k, id] of Object.entries(aliases)) {
    if (t.includes(k)) return BODIES.find((b) => b.id === id);
  }
  return BODIES.find((b) => t.includes(b.name.toLowerCase()));
}

function studioPath(text: string): string | null {
  if (/\bempty stretch|solar (system|walk)|space walk\b/.test(text)) {
    return "/apps/empty-stretch/play";
  }
  if (/\bfieldvault|walkdown|field vault|walkscore|fixplot\b/.test(text)) return "/apps/fieldvault";
  if (/\blookout|detector|object detection|vision lab|open (your )?eyes|aether.?s eyes\b/.test(text)) {
    return "/apps/aether/see";
  }
  if (/\b(drone|craft|take off|autopilot|boat|rover|cast off|roll out)\b/.test(text)) {
    return "/apps/aether/craft";
  }
  if (/\bprojects?\b/.test(text)) return "/apps/fieldvault";
  if (/\bapps?\b/.test(text)) return "/apps";
  if (/\bhome|overview|studio\b/.test(text)) return "/";
  const work = WORK.find((w) => text.includes(w.slug) || text.includes(w.title.toLowerCase()));
  if (work) return `/apps/${work.slug}`;
  return null;
}

function isCraft(q: string) {
  return /\b(take off|takeoff|cast off|roll out|launch|land the (drone|craft|boat|rover)|dock|park the|hold position|hold heading|hold the (drone|craft|boat)|open (the )?(drone|craft)|autopilot|drone status|craft status|boat status)\b/.test(
    q,
  );
}

async function runCraft(q: string, ctx: Ctx): Promise<Reply> {
  await ensureCraft(ctx);
  const copy = hullCopy();
  if (/take off|takeoff|cast off|roll out|launch/.test(q)) {
    sendCmd({ type: "craft-takeoff" });
    return { text: `${copy.going}. Autopilot will hold if the path is blocked.`, speak: copy.going + ".", ran: "craft" };
  }
  if (/\b(land|dock|park)\b/.test(q)) {
    sendCmd({ type: "craft-land" });
    return { text: copy.stopping + ".", ran: "craft" };
  }
  if (/hold heading|keep heading|hold course/.test(q)) {
    sendCmd({ type: "craft-heading" });
    return { text: "Heading hold. I'll only yaw for hazards.", speak: "Heading hold.", ran: "craft" };
  }
  if (/hold/.test(q)) {
    sendCmd({ type: "craft-hold" });
    return { text: "Hold.", ran: "craft" };
  }
  if (/autopilot/.test(q)) {
    sendCmd({ type: "craft-auto" });
    return { text: "Autopilot on.", ran: "craft" };
  }
  sendCmd({ type: "see-start" });
  return { text: `Craft is up (${copy.label.toLowerCase()}). ${copy.ready}`, ran: "craft" };
}

function isVision(q: string) {
  return /\b(what do you see|what.?s in (the )?(frame|shot|picture|view)|describe (the )?(scene|frame|view|room)|what.?s on the (map|sketch)|what have you seen|inventory|heading|how far have i|start (the )?camera|stop (the )?camera|open (your )?eyes|lookout|path blocked|path clear|copy (the )?(json|payload|frame)|watch for|how many|find (the |a |my )?|where(?:'?s| is) (the |my )?|look for|search for|point (at|to)|only (track|watch|see)|track only|just (people|cars|dogs|animals)|follow (the |that |nearest |#?\d+)?|calibrate|not a thing|ignore (that|this|it)|pin (that|this|it)|keep that|skip( it)?|move on|record (this |the )?(run|session)|stop recording|export (the )?(run|session|chart|coco|geojson|zip)|replay|target (that|this|it)|fallen|anyone down|go home|return home|orbit|waypoint|set home|undo|tour the (map|sketch)|quiet hours|quiet watch|this door|geofence|when I get to|fieldvault)\b/.test(
    q,
  );
}

async function runVision(q: string, ctx: Ctx): Promise<Reply> {
  await ensureSee(ctx);

  if (/stop (the )?camera/.test(q)) {
    sendCmd({ type: "see-stop" });
    return { text: "Camera off.", ran: "see" };
  }

  if (/start (the )?camera|open (your )?eyes/.test(q) && !/what do you see/.test(q)) {
    sendCmd({ type: "see-start" });
    return {
      text: "Eyes open. Allow the camera if the browser asks.",
      speak: "Eyes open.",
      ran: "see",
    };
  }

  const watch = parseWatch(q);
  if (watch) {
    setWatch(watch);
    sendCmd({ type: "see-watch", body: watch.join(",") });
    sendCmd({ type: "see-start" });
    return {
      text: watch.length
        ? `Tracking only ${watch.join(", ")}. Everything else is ignored.`
        : "Tracking everything again.",
      speak: watch.length ? `Tracking only ${watch.join(", ")}.` : "Full scan.",
      ran: "see",
    };
  }

  if (/\bcalibrate\b/.test(q)) {
    sendCmd({ type: "see-calibrate" });
    return { text: "Calibrating on this view. Ghosts in frame are ignored.", speak: "Calibrated.", ran: "see" };
  }

  if (/\bfollow\s+#?(\d+)\b/.test(q) && !parsePlan(q)) {
    const id = Number(q.match(/\bfollow\s+#?(\d+)\b/)?.[1]);
    if (Number.isFinite(id)) {
      setSeekId(id);
      sendCmd({ type: "see-follow", body: String(id) });
      if (!ctx.pathname.includes("/aether/craft")) ctx.navigate("/apps/aether/craft");
      return { text: `Following #${id}.`, speak: `Following ${id}.`, ran: "craft" };
    }
  }

  if (/\btarget (that|this|it|#?\d+)\b/.test(q)) {
    const frame = getLastFrame();
    const n = q.match(/#?(\d+)/)?.[1];
    const box = n ? frame?.objects.find((o) => o.id === Number(n)) : frame?.objects[0];
    if (box?.id != null) {
      setSeekId(box.id);
      setSeek(box.class);
      sendCmd({ type: "see-follow", body: String(box.id) });
      return { text: `Target #${box.id} ${box.class}.`, speak: `Target ${box.id}.`, ran: "see" };
    }
    return { text: "Nothing to target.", ran: "see" };
  }

  if (/\b(skip|move on)\b/.test(q)) {
    skipPlan();
    return { text: "Skipping this step.", speak: "Moving on.", ran: "craft" };
  }

  if (/\bwhat.?s on the (map|sketch)|what have you seen|inventory\b/.test(q)) {
    const text = inventory();
    return { text, speak: text, ran: "see" };
  }

  if (/\b(heading|how far have i|where am i)\b/.test(q)) {
    const text = describePose();
    return { text, speak: text, ran: "see" };
  }

  if (/\bfollow nearest\b/.test(q)) {
    const frame = getLastFrame();
    const want = canonicalClass(q) || (/\bperson|people\b/.test(q) ? "person" : undefined);
    const pool = (frame?.objects || []).filter((o) => (want ? o.class === want : true) && o.layer !== "bg");
    const box = pool.sort((a, b) => (a.range === "near" ? 0 : 1) - (b.range === "near" ? 0 : 1) || b.score - a.score)[0];
    if (box?.id != null) {
      setSeekId(box.id);
      sendCmd({ type: "see-follow", body: String(box.id) });
      if (!ctx.pathname.includes("/aether/craft")) ctx.navigate("/apps/aether/craft");
      return { text: `Following nearest #${box.id} ${box.name || box.class}.`, speak: `Following ${box.id}.`, ran: "craft" };
    }
    return { text: "Nothing near enough to follow.", ran: "see" };
  }

  if (/\bhow many\b/.test(q)) {
    const frame = getLastFrame();
    const cls = canonicalClass(q);
    const objs = (frame?.objects || []).filter((o) => o.layer !== "bg");
    const n = cls ? objs.filter((o) => o.class === cls || o.name === cls).length : objs.length;
    const text = cls ? `${n} ${cls}${n === 1 ? "" : "s"}.` : `${n} labeled objects.`;
    return { text, speak: text, ran: "see" };
  }

  if (/\bdescribe (the )?room\b/.test(q)) {
    const text = inventory();
    return { text, speak: text, ran: "see" };
  }

  if (/\b(fallen|anyone down|who.?s down)\b/.test(q)) {
    const frame = getLastFrame();
    const down = (frame?.objects || []).filter((o) => o.stance === "fallen");
    const text = down.length
      ? `${down.length} fallen: ${down.map((o) => `#${o.id}`).join(", ")}.`
      : "No fallen pose in frame.";
    return { text, speak: text, ran: "see" };
  }

  if (/\b(go home|return home|rtl)\b/.test(q)) {
    const h = homeOf();
    if (h) setNavTarget(h.wx, h.wy, h.name);
    else setNavTarget(0, 0, "home");
    setCraftOrder("rtl");
    if (!ctx.pathname.includes("/aether/craft")) ctx.navigate("/apps/aether/craft");
    return { text: "Returning home on the sketch.", speak: "Returning home.", ran: "craft" };
  }

  if (/\bhold (\d+(?:\.\d+)?) ?m/.test(q) || /\bhold (\d+) meters?\b/.test(q)) {
    const m = Number(q.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
    const { setStandoffMeters } = await import("@/vision/autopilot");
    setStandoffMeters(m);
    setCraftOrder("orbit");
    return { text: `Hold ${m} m from the lock. Needs person-scale or a door tap.`, ran: "craft" };
  }

  if (/\borbit\b/.test(q)) {
    setCraftOrder("orbit");
    if (!ctx.pathname.includes("/aether/craft")) ctx.navigate("/apps/aether/craft");
    return { text: "Orbiting the target.", speak: "Orbit.", ran: "craft" };
  }

  if (/\bset home\b/.test(q)) {
    const p = getPose();
    addWaypoint("home", p.x, p.y, "home");
    return { text: "Home is this pose.", speak: "Home set.", ran: "see" };
  }

  if (/\bwaypoint\b/.test(q)) {
    const name = after(q, /waypoint\s+(.+)/) || "wp";
    const existing = findWaypoint(name);
    if (existing && /go to|navigate|find/.test(q)) {
      setNavTarget(existing.wx, existing.wy, existing.name);
      setCraftOrder("rtl");
      ctx.navigate("/apps/aether/craft");
      return { text: `Going to ${existing.name}.`, ran: "craft" };
    }
    const p = getPose();
    addWaypoint(name, p.x, p.y);
    return { text: `Dropped waypoint ${name}.`, ran: "see" };
  }

  if (/\bthis door\b/.test(q)) {
    const frame = getLastFrame();
    const door = frame?.objects.find((o) => /door/.test(o.class)) || frame?.objects[0];
    const m = door ? setScaleFromDoor(door.h, 36) : 0;
    return { text: m ? `Scale set from that box (${m.toFixed(2)} m per unit).` : "No box to scale from.", ran: "see" };
  }

  if (/\bexport (the )?(chart|pack)\b/.test(q)) {
    const p = await chartPack();
    return { text: `Chart pack saved. Hash ${p.hash.slice(0, 12)}.`, ran: "see" };
  }
  if (/\bexport coco\b/.test(q)) {
    cocoExport();
    return { text: "COCO JSON downloaded.", ran: "see" };
  }
  if (/\bexport geojson\b/.test(q)) {
    geoJsonExport();
    return { text: "GeoJSON downloaded.", ran: "see" };
  }

  if (/\btour the (map|sketch)\b/.test(q)) {
    const text = `${inventory()} ${describePose()}`;
    return { text, speak: text, ran: "see" };
  }

  if (/\bundo\b/.test(q)) {
    const text = undoLast();
    return { text, speak: text, ran: "see" };
  }

  if (/\bquiet hours\b/.test(q)) {
    const range = q.match(/(\d{1,2})\s*-\s*(\d{1,2})/)?.[0] || "22-7";
    setQuiet(range.replace(/\s/g, ""));
    return { text: `Quiet hours ${range}. I still act; I speak less.`, ran: "see" };
  }

  if (/\bquiet watch\b/.test(q)) {
    const { setQuietWatch } = await import("@/vision/announce");
    setQuietWatch(true);
    return { text: "Quiet watch. I only speak on new IDs, lock, or fallen.", ran: "see" };
  }

  if (/\bgeofence|when I get to\b/.test(q)) {
    const name = after(q, /(?:to|at)\s+(.+)/) || "here";
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }),
      );
      const routine = q.match(/\brun (\w+)/)?.[1];
      addFence(name.replace(/\s*run \w+/, "").trim() || "here", pos.coords.latitude, pos.coords.longitude, 80, routine);
      return { text: `Fence “${name}” here${routine ? `, runs ${routine}` : ""}.`, ran: "see" };
    } catch {
      return { text: "Need location for a fence.", ran: "see" };
    }
  }

  if (/\b(lost ids|miss log|who did you lose)\b/.test(q)) {
    const { missLine } = await import("@/vision/miss");
    return { text: missLine(), ran: "eyes" };
  }

  if (/\bexport zip\b/.test(q)) {
    const p = await zipPack();
    return { text: `Zip pack saved. Hash ${p.hash.slice(0, 12)}.`, ran: "see" };
  }
  if (/\bfieldvault walk|walkdown json\b/.test(q)) {
    await fieldVaultWalk();
    return { text: "FieldVault walkdown JSON downloaded from the visit database.", ran: "export" };
  }

  if (/\bjoin (room|mesh)\b/.test(q)) {
    const code = after(q, /(?:room|mesh)\s+(.+)/) || "eyes";
    await joinMesh(code);
    return { text: `Joined mesh ${code}. Occupancy is shared with other crafts.`, ran: "craft" };
  }

  if (/\bfollow me\b/.test(q)) {
    startFollowMe();
    setSeek("person");
    sendCmd({ type: "see-start" });
    if (!ctx.pathname.includes("/aether/craft")) ctx.navigate("/apps/aether/craft");
    return { text: "Follow-me: GPS + nearest person. Not a radio lock.", ran: "craft" };
  }

  if (/\b(mavlink|hull link|nmea out)\b/.test(q)) {
    downloadMavlink();
    return { text: "MAVLink JSON + NMEA line downloaded. That is a file, not a radio.", ran: "export" };
  }

  if (/\bfailsafe\b/.test(q)) {
    return { text: failLine(), ran: "safety" };
  }

  if (/\b(yes|go ahead|do it|confirm)\b/.test(q) && hasPending()) {
    const p = takePending();
    if (p) return await p.run();
  }

  if (/\bwhere(?:'?s| is)\b/.test(q)) {
    const cls = parseSeek(q) || canonicalClass(q.replace(/where(?:'?s| is)\s+(the |a |an |my )?/, ""));
    const needle = cls || after(q, /where(?:'?s| is)\s+(?:the |a |an |my )?(.+)/);
    await ensureSee(ctx);
    const text = whereIs(needle || "that");
    return { text, speak: text, ran: "see" };
  }

  if (/\brecord (this |the )?(run|session)|start recording\b/.test(q)) {
    sendCmd({ type: "see-record", on: true });
    return { text: "Recording this run.", speak: "Recording.", ran: "see" };
  }
  if (/\bstop recording\b/.test(q)) {
    sendCmd({ type: "see-record", on: false });
    return { text: "Recording stopped.", ran: "see" };
  }
  if (/\bexport (the )?(run|session)\b/.test(q)) {
    sendCmd({ type: "see-export" });
    return { text: "Session copied.", ran: "see" };
  }

  if (/\b(not a thing|ignore (that|this|it)|that.?s not (real|a thing))\b/.test(q)) {
    const frame = getLastFrame();
    const box = frame?.objects[0];
    if (box?.id != null) sendCmd({ type: "see-ignore", body: String(box.id) });
    return { text: box ? `Ignored ${box.class}.` : "Nothing to ignore.", ran: "see" };
  }

  if (/\b(pin (that|this|it)|keep that|hold that id)\b/.test(q)) {
    const frame = getLastFrame();
    const box = frame?.objects.find((o) => o.class === frame.seek) || frame?.objects[0];
    if (box?.id != null) sendCmd({ type: "see-pin", body: String(box.id) });
    return { text: box ? `Pinned #${box.id}.` : "Nothing to pin.", speak: box ? "Pinned." : "Nothing to pin.", ran: "see" };
  }

  const taught = taughtList().find((t) => t.name && q.includes(t.name.toLowerCase()));
  const seek = taught?.name || parseSeek(q);
  if (seek && /\b(find|where|look for|search for|point|get the|see the|go to|follow)\b/.test(q)) {
    const color = parseColor(q);
    setSeek(seek, color);
    sendCmd({ type: "see-seek", body: seek, id: color });
    if (ctx.pathname.includes("/aether/craft")) sendCmd({ type: "craft-auto" });
    else sendCmd({ type: "see-start" });
    await sleep(400);
    const frame = getLastFrame();
    const text = describeFrame(frame);
    const label = color ? `${color} ${seek}` : seek;
    return {
      text: `Looking for ${label}. ${text}`,
      speak: `Looking for ${label}.`,
      ran: "see",
    };
  }

  if (/copy (the )?(json|payload|frame)/.test(q)) {
    sendCmd({ type: "see-copy" });
    return { text: "Frame JSON copied.", ran: "see" };
  }

  if (/lookout|open (your )?eyes/.test(q) && !/what|see|path|how many/.test(q)) {
    sendCmd({ type: "see-start" });
    return { text: "Eyes are up. Ask me what I see.", ran: "see" };
  }

  await sleep(200);
  const frame = getLastFrame();
  const text = describeFrame(frame);
  if (/how many/.test(q) && frame) {
    const want = /people|person/.test(q)
      ? "person"
      : /truck/.test(q)
        ? "truck"
        : /car/.test(q)
          ? "car"
          : "";
    const n = want ? frame.objects.filter((o) => o.class === want).length : frame.objects.length;
    return { text: `${n}. ${text}`, speak: `${n}.`, ran: "see" };
  }
  if (/path/.test(q) && frame) {
    return {
      text: frame.block ? "Path blocked." : "Path clear.",
      ran: "see",
    };
  }
  if (!frame) {
    sendCmd({ type: "see-start" });
    return {
      text: "I don't have a frame yet. Starting the camera — ask me again once you see boxes.",
      ran: "see",
    };
  }
  return { text, speak: text, ran: "see" };
}

function gateDial(r: Reply): Reply {
  ingestReply("");
  if (r.ran === "sms" && r.actions?.some((a) => a.kind === "sms")) {
    const full = { ...r };
    setPending("sms", async () => full);
    return {
      ...r,
      text: `${r.text}\nSay yes to open Messages.`,
      speak: "Say yes to text.",
      actions: [...(r.actions || []), { kind: "confirm", label: "Yes" }, { kind: "cancel", label: "No" }],
    };
  }
  if (!r.dial) {
    logAction(r.ran || "act", r.text.slice(0, 120));
    return r;
  }
  const full = { ...r };
  setPending("call", async () => full);
  logAction("pending", "call");
  return {
    ...r,
    actions: [
      ...(r.actions || []),
      { kind: "confirm", label: "Yes" },
      { kind: "cancel", label: "No" },
    ],
    dial: undefined,
    text: `${r.text}\nSay “yes” or tap Yes to dial.`,
    speak: "Say yes to place the call.",
  };
}

function armTimer(seconds: number, label: string, ctx: Ctx) {
  const id = Math.random().toString(36).slice(2, 8);
  const rec = {
    id,
    label,
    ends: Date.now() + seconds * 1000,
    handle: null as ReturnType<typeof setTimeout> | null,
  };
  rec.handle = setTimeout(() => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
    persistTimers();
    if (!quietHours()) ctx.onTimer(label);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Aether", { body: label });
    }
  }, seconds * 1000);
  timers.push(rec);
  persistTimers();
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

async function briefNow(): Promise<Reply> {
  let w = "";
  let iss = "";
  try {
    w = (await weather("Lima Ohio")).line;
  } catch {
    w = "Weather is unreachable.";
  }
  try {
    iss = await issNow();
  } catch {
    iss = "ISS feed is quiet.";
  }
  const open = loadTasks().filter((t) => !t.done);
  const tasks = open.length ? `Open tasks: ${open.map((t) => t.text).join("; ")}.` : "";
  const nxt = nextAgenda();
  const nextLine = nxt ? `Next: ${nxt.title}${nxt.whenLabel ? ` ${nxt.whenLabel}` : ""}.` : "";
  const res = loadReservations()[0];
  const resLine = res ? `Reservation: ${res.party} at ${res.place}.` : "";
  const groc = loadList().filter((i) => !i.done);
  const listLine = groc.length ? `List: ${groc.map((i) => i.text).join(", ")}.` : "";
  const text = [clock(), w, iss, nextLine, resLine, tasks, listLine, describeWorld()].filter(Boolean).join(" ");
  return { text, speak: `${w} ${nextLine || tasks || "Standing by."}`, ran: "briefing" };
}

function fmtDur(s: number) {
  if (s < 90) return `${Math.round(s)} seconds`;
  if (s < 3600) return `${Math.round(s / 60)} minutes`;
  return `${(s / 3600).toFixed(1)} hours`;
}

function splitChain(raw: string): string[] | null {
  const parts = raw
    .split(/\s*(?:, then | then | and then |;\s*)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return parts.length >= 2 ? parts : null;
}

let inLlm = false;

export async function run(raw: string, ctx: Ctx): Promise<Reply> {
  const plan = parsePlan(raw.toLowerCase());
  const q = strip(rewrite(raw));
  if (!q) return { text: "Go ahead." };

  if (/^(yes|go ahead|do it|confirm)$/.test(q) && hasPending()) {
    const p = takePending();
    if (p) return await p.run();
  }
  if (/^undo$/.test(q)) {
    return { text: undoLast(), ran: "undo" };
  }

  const chain = splitChain(raw);
  if (chain && !inLlm) {
    const bits: Reply[] = [];
    for (const part of chain) {
      bits.push(await run(part, ctx));
    }
    ingestReply(q);
    return {
      text: bits.map((b) => b.text).join("\n\n"),
      speak: bits.map((b) => b.speak || b.text.split("\n")[0]).join(" "),
      ran: "chain",
      actions: bits.flatMap((b) => b.actions || []),
      dial: bits.find((b) => b.dial)?.dial,
    };
  }

  if (llmKey() && !inLlm) {
    inLlm = true;
    try {
      const llm = await tryLlm(raw, (s) => run(s, ctx));
      if (llm) {
        ingestReply(q);
        return llm;
      }
    } finally {
      inLlm = false;
    }
  }

  const quick = worldQa(q);
  if (quick) return quick;

  const mem = runMemory(q);
  if (mem?.ran === "routine") {
    const name = mem.text.replace(/^ROUTINE:/, "");
    const r = getRoutine(name);
    if (r) {
      const bits: Reply[] = [];
      for (const step of r.steps) {
        bits.push(await run(step, ctx));
      }
      return {
        text: bits.map((b) => b.text).join("\n\n"),
        speak: mem.speak,
        ran: "routine",
        actions: bits.flatMap((b) => b.actions || []),
      };
    }
  }
  if (mem) return mem;

  const thought = await think(q);
  if (thought.score >= 0.42) {
    const parts: Reply[] = [];
    for (const a of thought.agents) {
      if (parts.length && a.score < 0.4) continue;
      if (a.agent === "help" && thought.agents.length === 1) {
        return {
          text: HELP + `\n\n${thought.world}`,
          speak: "Fourteen subagents. I draft, see, and steer. I don't talk to the host.",
          ran: "help",
        };
      }
      if (a.agent === "brief") parts.push(await briefNow());
      else if (a.agent === "eyes" && !isCraft(q)) {
        const r = await runVision(q, ctx);
        parts.push({ ...r, ran: r.ran || "eyes" });
      } else if (a.agent === "craft") {
        const r = await runCraft(q, ctx);
        parts.push({ ...r, ran: r.ran || "craft" });
      } else {
        const r = await runSub(a.agent, q, ctx);
        if (r) {
          if (r.timerSec) armTimer(r.timerSec, r.timerLabel || "Reminder", ctx);
          parts.push(gateDial(r));
        }
      }
    }
    if (parts.length) {
      return {
        text: parts.map((p) => p.text).join("\n\n"),
        speak: parts.map((p) => p.speak || p.text.split("\n")[0]).join(" "),
        ran: parts.map((p) => p.ran).filter(Boolean).join("+") || thought.agent,
        why: thought.agents.map((a) => `${a.agent} ${a.score.toFixed(2)}`).join(" · "),
        actions: parts.flatMap((p) => p.actions || []),
        dial: parts.find((p) => p.dial)?.dial,
      };
    }
  }

  if (!inLlm) {
    inLlm = true;
    try {
      const llm = await tryLlm(raw, (s) => run(s, ctx));
      if (llm) return llm;
    } finally {
      inLlm = false;
    }
  }

  if (/^(help|what can you do|commands|capabilities)$/.test(q)) {
    return {
      text: HELP,
      speak: "I look things up, draft reservations, and hand you Call. I don't talk to the host for you.",
      ran: "help",
    };
  }

  if (/^(mute|be quiet|stop talking)$/.test(q)) {
    return { text: "Voice off.", speak: "", ran: "mute" };
  }
  if (/^(unmute|talk|voice on)$/.test(q)) {
    return { text: "Voice on.", ran: "unmute" };
  }

  if (plan) {
    const needsCraft = plan.some((s) => s.kind === "takeoff" || s.kind === "land" || s.kind === "hold" || s.kind === "cruise");
    if (needsCraft) await ensureCraft(ctx);
    else await ensureSee(ctx);
    startPlan(plan);
    const first = kickStep();
    if (first) sendCmd(first);
    const label = describePlan();
    return {
      text: `Running ${label}. I'll yaw to the target, lock when it's ahead and near, then continue.`,
      speak: `On it. ${plan.map((s) => (s.kind === "seek" ? `find ${s.target}` : s.kind === "takeoff" ? hullCopy().go.toLowerCase() : s.kind === "land" ? hullCopy().stop.toLowerCase() : s.kind)).join(", then ")}.`,
      ran: "plan",
    };
  }

  if (isCraft(q)) return runCraft(q, ctx);
  if (isVision(q)) return runVision(q, ctx);

  const intent = parseIntent(raw);
  const assisted = await runAssistant(intent);
  if (assisted) {
    if (assisted.timerSec) armTimer(assisted.timerSec, assisted.timerLabel || "Reminder", ctx);
    return gateDial(assisted);
  }

  if (/briefing|status report|good (morning|afternoon|evening)|what.?s the (situation|status)|daily (brief|report)/.test(q)) {
    return briefNow();
  }

  if (/^what time|^time$|what.?s the time|current time/.test(q) && !/\bin\b/.test(q)) {
    return { text: clock(), ran: "clock" };
  }
  const inPlace = after(q, /(?:time in|what time is it in) (.+)/);
  if (inPlace) {
    try {
      return { text: await timeAt(inPlace), ran: "timezone" };
    } catch {
      return { text: `I could not get the time in ${inPlace}.` };
    }
  }

  if (/\bweather|temperature|forecast|sunrise|sunset\b/.test(q)) {
    const place =
      after(q, /(?:weather|forecast|temperature|sunrise|sunset)(?: in| for| at)? (.+)/) ||
      "Lima Ohio";
    try {
      const w = await weather(place.replace(/\b(like|please)\b/g, "").trim());
      return { text: w.line, ran: "weather" };
    } catch (err) {
      const busy = err instanceof Error && err.message === "busy";
      return {
        text: busy
          ? "Weather is rate-limited. Try once more in a few seconds."
          : "Weather didn't answer.",
      };
    }
  }

  if (/\biss\b|space station|where is (the )?(iss|station)/.test(q)) {
    try {
      return { text: await issNow(), ran: "iss" };
    } catch {
      return { text: "I can't reach the ISS feed right now." };
    }
  }

  if (/where am i|my location|current location|locate me/.test(q)) {
    try {
      return { text: await here(), ran: "location" };
    } catch {
      return { text: "Location is blocked. Allow it when the browser asks." };
    }
  }

  const wikiQ = after(q, /(?:wikipedia|look up|lookup|who is|what is|what.?s a|tell me about|search for) (.+)/);
  if (wikiQ && !/weather|timer|task|table|reserve|call/.test(q)) {
    try {
      if (/^define |definition of /.test(q) || wikiQ.split(" ").length === 1) {
        const d = await define(wikiQ);
        if (!d.startsWith("No definition")) return { text: d, ran: "define" };
      }
      return { text: await wiki(wikiQ), ran: "wiki" };
    } catch {
      return { text: "Lookup failed." };
    }
  }
  const defQ = after(q, /(?:define|definition of) (.+)/);
  if (defQ) {
    try {
      return { text: await define(defQ), ran: "define" };
    } catch {
      return { text: "No dictionary hit." };
    }
  }

  if (/^(calculate|compute|what is|what.?s)\s/.test(q) || /^[\d+\-*/().%\s]+$/.test(q)) {
    const expr = q.replace(/^(calculate|compute|what is|what.?s)\s+/, "");
    const n = calc(expr);
    if (n !== null) return { text: String(n), ran: "calc" };
  }

  const dur = parseDuration(q);
  if (dur && /(timer|remind|alarm|wake)/.test(q)) {
    const labelMatch = q.match(/(?:remind me to|timer for|timer to|alarm to) (.+?)(?: in | for )/);
    const label =
      labelMatch?.[1] ||
      after(q, /remind me(?: to)? (.+)/) ||
      `${fmtDur(dur)} timer`;
    armTimer(dur, label.replace(/\s+(in|for)\s+\d.*$/, "").trim() || `${fmtDur(dur)} timer`, ctx);
    return {
      text: `I'll speak in ${fmtDur(dur)}.`,
      ran: "timer",
    };
  }
  if (dur && /^(set |start |make )?(a )?timer/.test(q)) {
    armTimer(dur, `${fmtDur(dur)} timer`, ctx);
    return { text: `Timer set for ${fmtDur(dur)}.`, ran: "timer" };
  }
  if (/^(timers|list timers)$/.test(q)) {
    if (!timers.length) return { text: "No timers running." };
    const lines = timers.map((t) => {
      const left = Math.max(0, Math.round((t.ends - Date.now()) / 1000));
      return `${t.label} — ${fmtDur(left)} left`;
    });
    return { text: lines.join(". "), ran: "timers" };
  }

  const noteText = after(q, /(?:note that|take a note|remember that|remember|note:|save note) (.+)/);
  if (noteText && !digitsPhoneSafe(raw)) {
    addNote(noteText);
    return { text: `Noted. ${noteText}`, ran: "note" };
  }
  if (/^(notes|list notes|show notes|what did i note)/.test(q)) {
    const notes = loadNotes();
    if (!notes.length) return { text: "No notes yet." };
    return { text: notes.slice(0, 8).map((n) => n.text).join(". "), ran: "notes" };
  }
  if (/clear notes|delete notes/.test(q)) {
    clearNotes();
    return { text: "Notes cleared.", ran: "notes" };
  }

  const taskAdd = after(q, /(?:add task|new task|todo|to do|remind me later to) (.+)/);
  if (taskAdd) {
    addTask(taskAdd);
    return { text: `On the list: ${taskAdd}`, ran: "task" };
  }
  if (/^(tasks|list tasks|to-?dos?|what.?s on (the )?list)/.test(q)) {
    const tasks = loadTasks();
    if (!tasks.length) return { text: "Task list is empty." };
    const line = tasks
      .map((t) => `${t.done ? "done" : "open"}: ${t.text}`)
      .join(". ");
    return { text: line, ran: "tasks" };
  }
  const doneQ = after(q, /(?:complete|finish|check off|done with)(?: task)? (.+)/);
  if (doneQ || /^(complete|finish) task$/.test(q)) {
    const hit = completeTask(doneQ);
    if (!hit) return { text: "No matching open task." };
    return { text: `Closed: ${hit.text}`, ran: "task" };
  }

  if (/open maps?|map of|directions to|navigate to/.test(q)) {
    const place =
      after(q, /(?:open maps?|map of|directions to|navigate to) (.+)/) || "Lima Ohio";
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
    window.open(url, "_blank", "noopener");
    return { text: `Maps for ${place}.`, ran: "maps" };
  }

  if (/\b(email|mail|draft)\b/.test(q)) {
    const addr = q.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0];
    const subject = after(q, /(?:subject |about |re )(.+)/) || "From Aether";
    const href = `mailto:${addr || ""}?subject=${encodeURIComponent(subject)}`;
    window.location.href = href;
    return {
      text: addr
        ? `Mail draft to ${addr}. You hit send.`
        : "Mail draft opened. I can't send from here.",
      ran: "mail",
    };
  }

  const copyText = after(q, /(?:copy|clipboard) (.+)/);
  if (copyText) {
    try {
      await navigator.clipboard.writeText(copyText);
      return { text: "Copied.", ran: "copy" };
    } catch {
      return { text: "Clipboard is blocked." };
    }
  }

  if (/export notes|download notes/.test(q)) {
    const blob = new Blob(
      [loadNotes().map((n) => `- ${n.text}`).join("\n") || "No notes."],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aether-notes.txt";
    a.click();
    return { text: "Notes file downloaded.", ran: "export" };
  }

  if (/compress|cheat scale|log scale/.test(q)) {
    await ensurePlay(ctx);
    sendCmd({ type: "cheat", on: true });
    return { text: "Compress is on. Distances are a lie now.", ran: "stretch" };
  }
  if (/true scale|honest scale|no cheat/.test(q)) {
    await ensurePlay(ctx);
    sendCmd({ type: "cheat", on: false });
    return { text: "True scale. Empty on purpose.", ran: "stretch" };
  }
  if (/\bping(\s+earth)?\b/.test(q)) {
    await ensurePlay(ctx);
    sendCmd({ type: "ping" });
    return { text: "Ping is in the air.", ran: "stretch" };
  }
  if (/start (the )?(walk|game|stretch)|play empty/.test(q)) {
    await ensurePlay(ctx);
    sendCmd({ type: "start" });
    return { text: "Empty Stretch is live.", ran: "stretch" };
  }
  if (/jump to|take me to|go to (the )?(sun|mercury|venus|earth|mars|jupiter|saturn|uranus|neptune|pluto|voyager|heliopause|pale)/.test(q) || bodyFrom(q)) {
    const b = bodyFrom(q);
    if (b) {
      await ensurePlay(ctx);
      sendCmd({ type: "jump", body: b.id });
      return { text: `On our way to ${b.name}.`, ran: "stretch" };
    }
  }

  if (/speed (walk|highway|airliner|iss|voyager|light)/.test(q)) {
    const id = q.match(/walk|highway|airliner|iss|voyager|light/)![0];
    await ensurePlay(ctx);
    sendCmd({ type: "speed", id });
    return { text: `Speed set to ${id}.`, ran: "stretch" };
  }

  const path = studioPath(q);
  if (path && /^(open|go to|show|take me|launch|play|visit)/.test(q)) {
    ctx.navigate(path);
    return { text: "Opening that.", ran: "nav" };
  }
  if (path && /(empty stretch|fieldvault|walkscore|fixplot|projects|apps|coming soon|drone)/.test(q)) {
    ctx.navigate(path);
    return { text: "Opening that.", ran: "nav" };
  }

  if (/where am i in (space|the system)|how far|light lag/.test(q)) {
    await ensurePlay(ctx);
    sendCmd({ type: "query" });
    const sim = await new Promise<{ km: number; near?: string } | null>((resolve) => {
      const t = setTimeout(() => resolve(null), 300);
      const on = (e: Event) => {
        clearTimeout(t);
        window.removeEventListener("aether:sim", on);
        resolve((e as CustomEvent).detail);
      };
      window.addEventListener("aether:sim", on);
    });
    if (!sim) return { text: "Empty Stretch isn't answering yet. Try Play first." };
    const au = sim.km / 149597870.7;
    return { text: `You're ${au.toFixed(3)} AU from the Sun.`, ran: "stretch" };
  }

  return {
    text: "I need a task. Try “table for 4 Saturday 7 at Hunan”, “call 419-228-1995”, or “coffee nearby”.",
    speak: "Give me a place, a number, or a job.",
  };
}

function digitsPhoneSafe(s: string) {
  return /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/.test(s);
}
