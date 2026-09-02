"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { counts, detect, getSeek, loadModel, pinTrack, resetTracks, setSeek, setSeekId, type Frame } from "./detector";
import { idleCraft, step, steer, type CraftState, type Mode } from "./autopilot";
import { HULL, hullCopy, loadHull, saveHull, type Hull } from "./hull";
import { publishFrame, takePending, type Cmd } from "@/aether/bus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ingest } from "./room";
import { announceFrame } from "./announce";
import { describePlan, syncPlan } from "@/aether/plan";
import { metersPerUnit } from "./waypoints";
import { makeRecognizer, stopSpeaking } from "@/aether/speech";

function drawHud(
  canvas: HTMLCanvasElement,
  src: HTMLVideoElement,
  frame: Frame | null,
  craft: CraftState,
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (src.readyState >= 2) ctx.drawImage(src, 0, 0, w, h);
  else {
    ctx.fillStyle = "#0c0c0d";
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(212,160,84,0.85)";
  ctx.lineWidth = Math.max(1.5, w / 500);
  const cx = w / 2;
  const cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 28, cy);
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx, cy - 6);
  ctx.stroke();

  if (frame) {
    ctx.font = `${Math.max(11, w / 48)}px ui-sans-serif, system-ui`;
    for (const o of frame.objects) {
      if (o.trail && o.trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(212,160,84,0.45)";
        ctx.lineWidth = Math.max(1.5, w / 420);
        o.trail.forEach((p, i) => {
          const x = p.x * w;
          const y = p.y * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      const x = o.x * w;
      const y = o.y * h;
      const bw = o.w * w;
      const bh = o.h * h;
      const seek = frame.seek;
      const target = seek && (o.class === seek || o.name === seek);
      if (o.layer === "bg" && !target) {
        ctx.globalAlpha = 0.28;
      } else {
        ctx.globalAlpha = seek && !target ? 0.4 : 1;
      }
      ctx.strokeStyle = o.coasting ? "rgba(212,160,84,0.5)" : "#d4a054";
      ctx.setLineDash(o.coasting ? [5, 4] : []);
      ctx.lineWidth = target ? Math.max(3, w / 240) : Math.max(1.5, w / 400);
      ctx.strokeRect(x, y, bw, bh);
      ctx.setLineDash([]);
      const tag = (o.name || o.class).replace(/^aquatic:/, "");
      const label = `${o.id != null ? "#" + o.id + " " : ""}${o.color ? o.color + " " : ""}${tag}${o.meters != null ? " " + o.meters + "m" : o.range ? " " + o.range : ""}`;
      ctx.globalAlpha = 1;
      ctx.fillStyle = o.layer === "bg" && !target ? "#c8c4ba" : "#d4a054";
      ctx.fillRect(x, Math.max(0, y - 18), ctx.measureText(label).width + 8, 18);
      ctx.fillStyle = "#0c0c0d";
      ctx.fillText(label, x + 4, Math.max(13, y - 5));
    }
    if (frame.occupancy) {
      const occ = frame.occupancy;
      if (craft.hull === "water" && occ.blocked?.length) {
        const cols = occ.cols || 18;
        const rows = occ.rows || 12;
        const cw = w / cols;
        const rh = h / rows;
        ctx.fillStyle = "rgba(196, 72, 54, 0.22)";
        occ.blocked.forEach((b, i) => {
          if (!b) return;
          const c = i % cols;
          const r = Math.floor(i / cols);
          ctx.fillRect(c * cw, r * rh, cw, rh);
        });
      }
      if (occ.path && occ.path.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(212,160,84,0.7)";
        ctx.lineWidth = Math.max(2, w / 360);
        occ.path.forEach((p, i) => {
          const x = p.x * w;
          const y = p.y * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  ctx.fillStyle = "rgba(12,12,13,0.72)";
  ctx.fillRect(0, 0, w, 36);
  ctx.fillRect(0, h - 36, w, 36);
  ctx.fillStyle = "#d4a054";
  ctx.font = `${Math.max(12, w / 42)}px ui-monospace, monospace`;
  ctx.fillText(`HDG ${craft.hdg.toFixed(0).padStart(3, "0")}`, 12, 24);
  const copy = hullCopy(craft.hull);
  if (copy.usesAlt) ctx.fillText(`ALT ${craft.alt.toFixed(1)} m`, w / 2 - 50, 24);
  else {
    const ch = frame?.occupancy?.channel;
    ctx.fillText(ch ? ch.toUpperCase() : copy.label.toUpperCase(), w / 2 - 48, 24);
  }
  ctx.fillText(`SPD ${craft.spd.toFixed(1)}`, w - 110, 24);
  ctx.fillStyle = craft.mode === "hold" ? "#d4a054" : "#e8e4dc";
  ctx.fillText(craft.mode.toUpperCase(), 12, h - 14);
  ctx.fillStyle = "#9a958c";
  ctx.fillText(craft.auto ? "AUTO" : "MAN", w / 2 - 20, h - 14);
  if (craft.lock) {
    ctx.fillStyle = "#d4a054";
    ctx.fillText(craft.lock, w - 220, h - 14);
  } else {
    ctx.fillText(`${craft.x.toFixed(0)}, ${craft.y.toFixed(0)} m`, w - 130, h - 14);
  }
}

export function Craft({ backHref }: { backHref: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loop = useRef(0);
  const phys = useRef(0);
  const craftRef = useRef<CraftState>(idleCraft());
  const frameRef = useRef<Frame | null>(null);
  const detectedRef = useRef<Frame | null>(null);
  const readyRef = useRef(false);
  const liveRef = useRef(false);
  const pendingStart = useRef(false);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState("Loading eyes for the craft…");
  const [holding, setHolding] = useState(false);
  const holdRec = useRef<ReturnType<typeof makeRecognizer>>(null);
  const [craft, setCraft] = useState<CraftState>(idleCraft());
  const [hull, setHullState] = useState<Hull>(() => loadHull());
  const [frame, setFrame] = useState<Frame | null>(null);
  const planRef = useRef("");

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const v = videoRef.current;
    if (!canvas || !v) return;
    if (v.videoWidth) {
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
    }
    drawHud(canvas, v, frameRef.current, craftRef.current);
  }, []);

  async function startDownlink() {
    if (!readyRef.current) {
      pendingStart.current = true;
      setStatus("Detector first…");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 960 } },
        audio: false,
      });
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      liveRef.current = true;
      setLive(true);
      setStatus("Downlink live. Tracker holds IDs on moving animals and people.");
      resetTracks();
      let busy = false;
      let vis = 0;
      const tick = async () => {
        if (!videoRef.current) return;
        paint();
        if (!busy && v.readyState >= 2) {
          busy = true;
          vis = 0;
          try {
            const next = await detect(v, { minScore: 0.3, filter: "all", seek: getSeek() });
            detectedRef.current = next;
            frameRef.current = next;
            setFrame(next);
            publishFrame(next);
            ingest(next);
            announceFrame(next);
          } catch {
            /* keep */
          }
          busy = false;
        } else if (detectedRef.current) {
          vis += 1 / 60;
          const f = detectedRef.current;
          frameRef.current = {
            ...f,
            objects: f.objects.map((o) => ({
              ...o,
              x: o.x + (o.vx ?? 0) * vis,
              y: o.y + (o.vy ?? 0) * vis,
            })),
          };
        }
        loop.current = requestAnimationFrame(tick);
      };
      loop.current = requestAnimationFrame(tick);
    } catch {
      setStatus("Camera blocked. Allow it — that is the camera link.");
    }
  }

  function stopDownlink() {
    cancelAnimationFrame(loop.current);
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    liveRef.current = false;
    setLive(false);
  }

  function setMode(mode: Mode) {
    const c = { ...craftRef.current, mode };
    const copy = hullCopy(c.hull);
    if (mode === "takeoff" && c.alt <= 0) c.auto = true;
    if (mode === "cruise") c.auto = false;
    craftRef.current = c;
    setCraft(c);
    setStatus(
      mode === "takeoff"
        ? copy.going + "."
        : mode === "land"
          ? copy.stopping + "."
          : mode === "hold"
            ? "Hold."
            : mode === "cruise"
              ? "Underway. Autopilot off."
              : copy.idle + ".",
    );
  }

  useEffect(() => {
    let on = true;
    loadModel()
      .then(() => {
        if (!on) return;
        readyRef.current = true;
        setReady(true);
        setStatus(hullCopy(craftRef.current.hull).ready);
      })
      .catch(() => {
        if (on) setStatus("Detector did not load.");
      });

    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const desire = steer(frameRef.current, craftRef.current.hull, craftRef.current.headingHold);
      const next = step(craftRef.current, dt, desire);
      craftRef.current = next;
      setCraft({ ...next });
      syncPlan(next, desire.hunt);
      if (frameRef.current) announceFrame(frameRef.current, desire.hunt);
      const plan = describePlan();
      if (plan && plan !== planRef.current) {
        planRef.current = plan;
        setStatus(plan);
      }
    }, 80);
    phys.current = id;

    return () => {
      on = false;
      clearInterval(id);
      cancelAnimationFrame(loop.current);
      stopDownlink();
    };
  }, []);

  useEffect(() => {
    function handle(cmd: Cmd | null) {
      if (!cmd) return;
      if (cmd.type === "see-seek" && cmd.body) {
        setSeek(cmd.body, cmd.id);
        void startDownlink();
      }
      if (cmd.type === "see-follow" && cmd.body) {
        const id = Number(cmd.body);
        if (Number.isFinite(id)) {
          pinTrack(id);
          setSeekId(id);
        }
        void startDownlink();
      }
      if (cmd.type === "see-watch") {
        resetTracks();
        void startDownlink();
      }
      if (cmd.type === "see-start" || cmd.type === "craft-downlink") {
        void startDownlink();
      }
      if (cmd.type === "see-stop") stopDownlink();
      if (cmd.type === "craft-takeoff") {
        void startDownlink();
        setMode("takeoff");
      }
      if (cmd.type === "craft-hold") setMode("hold");
      if (cmd.type === "craft-land") setMode("land");
      if (cmd.type === "craft-auto") {
        craftRef.current = {
          ...craftRef.current,
          auto: true,
          headingHold: false,
          mode: craftRef.current.hull === "air" && craftRef.current.alt <= 4 ? craftRef.current.mode : "cruise",
        };
        setCraft({ ...craftRef.current });
        setStatus("Autopilot on. It holds when the path is blocked.");
      }
      if (cmd.type === "craft-heading") {
        craftRef.current = { ...craftRef.current, headingHold: true, auto: true, mode: "cruise" };
        setCraft({ ...craftRef.current });
        setStatus("Heading hold. Yaw only for hazards.");
      }
    }
    const on = (e: Event) => handle((e as CustomEvent<Cmd>).detail);
    window.addEventListener("aether:cmd", on);
    handle(takePending());
    return () => window.removeEventListener("aether:cmd", on);
  }, []);

  useEffect(() => {
    if (ready && pendingStart.current) {
      pendingStart.current = false;
      void startDownlink();
    }
  }, [ready]);

  function holdTalk(start: boolean) {
    if (start) {
      stopSpeaking();
      const rec = makeRecognizer({ continuous: false });
      holdRec.current = rec;
      if (!rec) {
        setStatus("No speech in this browser. Type in Aether.");
        return;
      }
      rec.onresult = (ev) => {
        const last = ev.results[ev.results.length - 1];
        if (!last.isFinal) return;
        const t = last[0].transcript.trim();
        if (t) window.dispatchEvent(new CustomEvent("aether:utterance", { detail: t }));
      };
      try {
        rec.start();
        setHolding(true);
        setStatus("Listening…");
      } catch {
        setStatus("Mic blocked.");
      }
      return;
    }
    holdRec.current?.stop();
    setHolding(false);
  }

  const copy = hullCopy(hull);
  const tally = frame ? counts(frame.objects.filter((o) => o.layer !== "bg")) : [];
  const channel = frame?.occupancy?.channel;
  const blocked =
    hull === "water"
      ? channel === "blocked" || Boolean(frame?.occupancy?.bowBlocked)
      : frame?.block || craft.mode === "hold";
  const channelLabel =
    hull !== "water"
      ? blocked
        ? "Path blocked"
        : "Path clear"
      : channel === "blocked" || frame?.occupancy?.bowBlocked
        ? "Hazard ahead — holding"
        : channel === "port"
          ? "Open water to port"
          : channel === "starboard"
            ? "Open water to starboard"
            : "Channel clear";

  function pickHull(h: Hull) {
    saveHull(h);
    setHullState(h);
    const next = { ...craftRef.current, hull: h };
    craftRef.current = next;
    setCraft(next);
    setStatus(hullCopy(h).ready);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <a href={backHref} className="text-sm text-muted hover:text-fg">
          Back
        </a>
        <p className="font-display text-lg">Aether · Craft</p>
        <div className="flex gap-1">
          {(Object.keys(HULL) as Hull[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => pickHull(id)}
              className={cn(
                "h-8 rounded-md border px-2.5 text-xs",
                hull === id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted hover:text-fg",
              )}
            >
              {HULL[id].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{status}</p>
      </header>
      <div className="grid flex-1 lg:grid-cols-12">
        <div className="relative bg-black lg:col-span-8">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas
            ref={canvasRef}
            className="mx-auto max-h-[52dvh] w-full object-contain sm:max-h-[62dvh] lg:max-h-[calc(100dvh-8rem)]"
          />
          {live && craft.lock ? (
            <p className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-surface/80 px-3 py-1.5 text-center text-sm font-medium text-primary">
              {craft.hunt === "locked" ? "LOCKED" : craft.hunt?.toUpperCase()} · {craft.lock}
              {craft.hunt === "orbit" || craft.lock.includes("orbit")
                ? ` · standoff ${metersPerUnit() ? `${(metersPerUnit() * 8).toFixed(1)} m` : "set door scale"}`
                : ""}
            </p>
          ) : null}
          {!live ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm text-muted">{copy.ready} Hold to talk is the mic.</p>
              <Button onClick={() => void startDownlink()} disabled={!ready}>
                {copy.arm}
              </Button>
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={() => setMode("takeoff")}>
                  {copy.go}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("hold")}>
                  {copy.hold}
                </Button>
              </div>
              <button
                type="button"
                className={cn(
                  "h-16 min-w-[9.5rem] rounded-full border px-6 text-sm font-medium",
                  holding
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface/85 text-fg",
                )}
                onPointerDown={(e) => {
                  e.preventDefault();
                  holdTalk(true);
                }}
                onPointerUp={() => holdTalk(false)}
                onPointerCancel={() => holdTalk(false)}
              >
                {holding ? "Listening…" : "Hold to talk"}
              </button>
              <Button size="sm" variant="outline" onClick={() => setMode("land")} className="mb-1">
                {copy.stop}
              </Button>
            </div>
          )}
        </div>
        <aside className="flex flex-col gap-4 border-t border-border p-4 pb-28 lg:col-span-4 lg:border-l lg:border-t-0 lg:pb-4">
          <div className="hidden flex-wrap gap-2 lg:flex">
            {live ? (
              <Button size="sm" variant="outline" onClick={stopDownlink}>
                {copy.cut}
              </Button>
            ) : (
              <Button size="sm" onClick={() => void startDownlink()} disabled={!ready}>
                {copy.arm}
              </Button>
            )}
            <Button size="sm" onClick={() => setMode("takeoff")} disabled={craft.mode === "takeoff"}>
              {copy.go}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("hold")}>
              {copy.hold}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("land")}>
              {copy.stop}
            </Button>
            {hull === "water" ? (
              <Button
                size="sm"
                variant={craft.headingHold ? "default" : "outline"}
                onClick={() => {
                  const next = { ...craftRef.current, headingHold: !craftRef.current.headingHold, auto: true, mode: "cruise" as const };
                  craftRef.current = next;
                  setCraft(next);
                  setStatus(next.headingHold ? "Heading hold. Yaw only for hazards." : "Channel follow.");
                }}
              >
                Heading hold
              </Button>
            ) : null}
          </div>
          <div>
            <p className={cn("font-display text-2xl", blocked ? "text-primary" : "text-fg")}>
              {channelLabel}
            </p>
            <p className="mt-1 text-sm text-muted">
              {craft.mode.toUpperCase()} · {craft.auto ? "autopilot" : "manual"} · {copy.label}
              {craft.headingHold ? " · heading hold" : ""}
              {craft.hull === "air" ? ` · ${craft.alt.toFixed(1)} m` : ` · ${craft.spd.toFixed(1)} spd`}
              {craft.hunt && craft.hunt !== "idle" ? ` · ${craft.hunt}` : ""}
              {craft.lock ? ` · ${craft.lock}` : ""}
            </p>
          </div>
          <ul className="space-y-1 text-sm text-muted">
            {tally.length ? (
              tally.map(([c, n]) => (
                <li key={c}>
                  {n} {c}
                </li>
              ))
            ) : (
              <li>No objects in frame.</li>
            )}
          </ul>
          <p className="text-xs leading-relaxed text-muted">
            {hull === "water"
              ? "Cast off. Autopilot follows the gold channel and yaws off red hazards (people, other boats, shore clutter). Heading hold keeps the current course. Same eyes as Air — not a real autopilot on a real hull."
              : `Thumb bar moves the ${copy.body}. Hold to talk sits in the middle so it doesn’t fight Aether. Target an ID in Eyes, then “${copy.go.toLowerCase()}, follow #3, hold.” Path is the gold line — we yaw onto it. Air, water, or ground — same eyes, same JSON.`}
          </p>
        </aside>
      </div>
    </div>
  );
}
