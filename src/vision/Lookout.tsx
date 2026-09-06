"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { counts, detect, embedCrop, FILTER_IDS, loadModel, mergeTracks, pinTrack, resetTracks, setBackground, setSeek, setSeekId, setWatch, type FilterId, type Frame } from "./detector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publishFrame, takePending, type Cmd } from "@/aether/bus";
import { ingest, loadRoom, drawRoom, clearRoom, rememberName, roomList } from "./room";
import { teachObject } from "./teach";
import { announceFrame, setCallouts, resetAnnounced, setQuietWatch } from "./announce";
import { backendNote } from "./backend";
import { calibrateFrom, clearMarks, ignoreBox, ignoreCount } from "./marks";
import { canvasNorm } from "./hit";
import { startSession, stopSession, isRecording, pushFrame, sessionCount, sessionJson, sessionClips, sessionStills, clearSession } from "./session";
import { chartPack, cocoExport, geoJsonExport, zipPack, downloadFloorplan, fieldVaultRow, fieldVaultWalk, vttExport } from "./pack";
import { addWaypoint, metersPerUnit } from "./waypoints";
import { getPose, canvasToWorld } from "./slam";
import { notThis } from "./negative";
import { joinMesh, tickMesh, meshPeers } from "./mesh";
import { startWebm, stopWebm, downloadWebm } from "./webm";
import { startAudioWatch } from "./audio";
import { bootBrain } from "@/aether/brain";
import { importFieldVault } from "@/aether/importfv";
import { missLine } from "./miss";
import { lastSound } from "./yamnet";

function draw(
  canvas: HTMLCanvasElement,
  src: HTMLVideoElement | HTMLImageElement,
  frame: Frame | null,
  seek?: string,
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  if (!frame) return;
  ctx.font = `${Math.max(12, w / 42)}px ui-sans-serif, system-ui`;
  for (const o of frame.objects) {
    const target = Boolean(seek && (o.class === seek || o.name === seek));
    if (o.trail && o.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = target ? "rgba(212,160,84,0.85)" : "rgba(212,160,84,0.35)";
      ctx.lineWidth = Math.max(2, w / 420);
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
    ctx.globalAlpha = o.layer === "bg" ? 0.38 : seek && !target ? 0.45 : 1;
    ctx.strokeStyle = o.pinned ? "#e8e4dc" : o.coasting ? "rgba(212,160,84,0.55)" : "#d4a054";
    ctx.setLineDash(o.coasting ? [6, 5] : []);
    ctx.lineWidth = o.pinned || target ? Math.max(3, w / 240) : Math.max(2, w / 320);
    ctx.strokeRect(x, y, bw, bh);
    if (o.pose && o.pose.length > 2) {
      const byName = new Map(o.pose.map((p) => [p.name, p]));
      const bones: [string, string][] = [
        ["left_shoulder", "right_shoulder"],
        ["left_shoulder", "left_hip"],
        ["right_shoulder", "right_hip"],
        ["left_hip", "right_hip"],
        ["left_shoulder", "left_elbow"],
        ["left_elbow", "left_wrist"],
        ["right_shoulder", "right_elbow"],
        ["right_elbow", "right_wrist"],
        ["left_hip", "left_knee"],
        ["left_knee", "left_ankle"],
        ["right_hip", "right_knee"],
        ["right_knee", "right_ankle"],
      ];
      ctx.strokeStyle = o.stance === "fallen" ? "#c45c4a" : "rgba(232,228,220,0.7)";
      ctx.lineWidth = Math.max(1.5, w / 480);
      for (const [a, b] of bones) {
        const pa = byName.get(a);
        const pb = byName.get(b);
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
        ctx.stroke();
      }
    }
    if (o.px != null && o.py != null && Math.hypot((o.vx ?? 0), (o.vy ?? 0)) > 0.08) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(232,228,220,0.45)";
      ctx.strokeRect(o.px * w, o.py * h, bw, bh);
      ctx.setLineDash([]);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const tag = (o.name || o.class).replace(/^aquatic:/, "");
    const lock = o.stable && !o.coasting;
    const bits = [
      o.id != null ? `#${o.id}` : "",
      lock ? "LOCK" : o.coasting ? "COAST" : "",
      o.color,
      tag,
      o.grasp?.cue,
      o.bearing,
      o.meters != null ? `${o.meters}m` : o.range,
      o.stance && o.stance !== "unknown" ? o.stance : "",
      o.stencil,
    ].filter(Boolean);
    const label = bits.join(" ");
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = lock ? "#d4a054" : o.layer === "bg" ? "#c8c4ba" : "#e8e4dc";
    ctx.fillRect(x, Math.max(0, y - 22), tw, 22);
    ctx.fillStyle = "#0c0c0d";
    ctx.fillText(label, x + 5, Math.max(14, y - 6));
  }
  const path = frame.occupancy?.path;
  if (path && path.length > 1) {
    const cols = frame.occupancy?.cols || 18;
    const rows = frame.occupancy?.rows || 12;
    ctx.strokeStyle = "rgba(212,160,84,0.85)";
    ctx.lineWidth = Math.max(2.5, w / 280);
    ctx.setLineDash([]);
    ctx.beginPath();
    path.forEach((c, i) => {
      const x = ((c.x + 0.5) / cols) * w;
      const y = ((c.y + 0.5) / rows) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

export function Lookout({ backHref }: { backHref: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loop = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading the detector…");
  const [live, setLive] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [minScore, setMinScore] = useState(0.28);
  const [filter, setFilter] = useState<FilterId>("all");
  const [seek, setSeekState] = useState<string>("");
  const [watch, setWatchState] = useState<string[]>([]);
  const [bg, setBg] = useState<"none" | "furniture" | "all">("furniture");
  const [recording, setRecording] = useState(false);
  const [clips, setClips] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const [teach, setTeach] = useState<{ id: number; class: string } | null>(null);
  const [teachName, setTeachName] = useState("");
  const [paintNogo, setPaintNogo] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const tape = useRef<{ wx: number; wy: number } | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const minRef = useRef(minScore);
  const filterRef = useRef(filter);
  const seekRef = useRef(seek);
  const watchRef = useRef(watch);
  const readyRef = useRef(false);
  const pendingStart = useRef(false);
  const frameRef = useRef<Frame | null>(null);
  minRef.current = minScore;
  filterRef.current = filter;
  seekRef.current = seek;
  watchRef.current = watch;
  readyRef.current = ready;
  frameRef.current = frame;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    loadRoom();
    let on = true;
    loadModel()
      .then(() => {
        if (!on) return;
        setReady(true);
        setStatus("Eyes on. Cortex booting.");
        void bootBrain();
      })
      .catch(() => {
        if (on) setStatus("The detector did not load. Check the network and try again.");
      });
    return () => {
      on = false;
      cancelAnimationFrame(loop.current);
      const v = videoRef.current;
      v?.srcObject && (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    function handle(cmd: Cmd | null) {
      if (!cmd?.type.startsWith("see")) return;
      if (cmd.type === "see-start") void startCamera();
      if (cmd.type === "see-stop") stopCamera();
      if (cmd.type === "see-copy") copyPayload();
      if (cmd.type === "see-filter" && cmd.id && (FILTER_IDS as readonly string[]).includes(cmd.id)) {
        setFilter(cmd.id as FilterId);
      }
      if (cmd.type === "see-seek" && cmd.body) {
        setSeekState(cmd.body);
        setSeek(cmd.body, cmd.id);
        setFilter("all");
        void startCamera();
      }
      if (cmd.type === "see-seek-clear") {
        setSeekState("");
        setSeek(undefined);
      }
      if (cmd.type === "see-watch") {
        const list = (cmd.body || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setWatchState(list);
        setWatch(list);
        resetTracks();
        setFilter("all");
      }
      if (cmd.type === "see-calibrate") {
        const f = frameRef.current;
        const r = calibrateFrom(f?.objects || []);
        setStatus(`Calibrated. ${r.ghosts} ignored. Floor ${Math.round(r.floor * 100)}%.`);
      }
      if (cmd.type === "see-ignore" && cmd.body) {
        const id = Number(cmd.body);
        const f = frameRef.current;
        const box = f?.objects.find((o) => o.id === id) || f?.objects[0];
        if (box) {
          ignoreBox(box);
          setStatus(`Ignored ${box.color ? box.color + " " : ""}${box.class}.`);
        }
      }
      if (cmd.type === "see-follow" && cmd.body) {
        const id = Number(cmd.body);
        if (Number.isFinite(id)) {
          pinTrack(id);
          setSeekId(id);
          const box = frameRef.current?.objects.find((o) => o.id === id);
          if (box) {
            setSeekState(box.class);
            setSeek(box.class);
          }
          setStatus(`Following #${id}.`);
          void startCamera();
        }
      }
      if (cmd.type === "see-pin" && cmd.body) {
        const id = Number(cmd.body);
        pinTrack(id);
        setStatus(`Pinned #${id}.`);
      }
      if (cmd.type === "see-record") {
        if (cmd.on === false) {
          stopSession();
          setRecording(false);
          setStatus(`Recording stopped. ${sessionCount()} frames.`);
        } else {
          startSession();
          setRecording(true);
          setClips(0);
          setStatus("Recording the run.");
        }
      }
      if (cmd.type === "see-export") {
        void navigator.clipboard.writeText(sessionJson());
        setStatus("Session JSON copied.");
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
      void startCamera();
    }
  }, [ready]);

  const paint = useCallback((src: HTMLVideoElement | HTMLImageElement, next: Frame, commit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let sw = 0;
    let sh = 0;
    if (src instanceof HTMLVideoElement) {
      sw = src.videoWidth;
      sh = src.videoHeight;
    } else {
      sw = src.naturalWidth || src.width;
      sh = src.naturalHeight || src.height;
    }
    if (sw && sh) {
      canvas.width = sw;
      canvas.height = sh;
    }
    draw(canvas, src, next, seekRef.current || undefined);
    if (!commit) return;
    setFrame(next);
    frameRef.current = next;
    publishFrame(next);
    ingest(next);
    tickMesh();
    announceFrame(next);
    if (isRecording()) {
      pushFrame(next, canvasRef.current);
      setClips(sessionCount());
    }
  }, []);

  async function startCamera() {
    if (!readyRef.current) {
      pendingStart.current = true;
      setStatus("Loading the detector first…");
      return;
    }
    setStatus("Asking for the camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 960 } },
        audio: true,
      });
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      startAudioWatch(stream);
      setLive(true);
      setStatus("Live. Tracker coasts between detects.");
      let busy = false;
      let vis = 0;
      const tick = async () => {
        if (!videoRef.current) return;
        if (!busy && v.readyState >= 2) {
          busy = true;
          vis = 0;
          try {
            const next = await detect(v, {
              minScore: minRef.current,
              filter: filterRef.current,
              seek: seekRef.current || undefined,
            });
            paint(v, next);
            if (next.night && !torchOn) {
              const stream = videoRef.current?.srcObject as MediaStream | null;
              const track = stream?.getVideoTracks()[0];
              void track?.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }).then(() => setTorchOn(true)).catch(() => undefined);
            }
          } catch {
            /* keep looping */
          }
          busy = false;
        } else if (frameRef.current) {
          vis += 1 / 60;
          const f = frameRef.current;
          paint(v, {
            ...f,
            objects: f.objects.map((o) => ({
              ...o,
              x: o.x + (o.vx ?? 0) * vis,
              y: o.y + (o.vy ?? 0) * vis,
            })),
          }, false);
        }
        loop.current = requestAnimationFrame(tick);
      };
      loop.current = requestAnimationFrame(tick);
    } catch {
      setStatus("Camera blocked. Use a photo instead.");
    }
  }

  function stopCamera() {
    cancelAnimationFrame(loop.current);
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setLive(false);
    setStatus("Camera off.");
  }

  async function loadSample(src: string) {
    cancelAnimationFrame(loop.current);
    stopCamera();
    const img = imageRef.current;
    if (!img) return;
    setStatus("Reading sample…");
    img.onload = async () => {
      try {
        const next = await detect(img, {
          minScore: Math.min(minRef.current, 0.28),
          filter: src.includes("fish") ? "fish" : src.includes("dog") ? "animals" : "all",
          seek: seekRef.current || undefined,
        });
        paint(img, next);
        setStatus(
          next.objects.length
            ? `${next.objects.length} tracked · ${next.ms ?? "–"} ms`
            : "Nothing above threshold on this sample.",
        );
      } catch {
        setStatus("Could not read that sample.");
      }
    };
    img.src = src;
  }

  async function onFile(file: File) {
    cancelAnimationFrame(loop.current);
    stopCamera();
    const url = URL.createObjectURL(file);
    const img = imageRef.current;
    if (!img) return;
    img.onload = async () => {
      setStatus("Reading the frame…");
      try {
        const next = await detect(img, { minScore: minRef.current, filter: filterRef.current, seek: seekRef.current || undefined });
        paint(img, next);
        setStatus(
          next.objects.length
            ? `${next.objects.length} object${next.objects.length === 1 ? "" : "s"} in the frame.`
            : "Nothing above the threshold.",
        );
      } catch {
        setStatus("Could not read that image.");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function copyPayload() {
    const f = frameRef.current;
    if (!f) return;
    void navigator.clipboard.writeText(JSON.stringify(f, null, 2));
    setStatus("Frame JSON copied. That is what a rover would ingest.");
  }

  function onCanvasClick(e: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const f = frameRef.current;
    if (!canvas || !f) return;
    const n = canvasNorm(e, canvas);
    if (!n) {
      setStatus("Tap the picture, not the margin.");
      return;
    }
    const hit = [...f.objects].reverse().find(
      (o) => n.nx >= o.x && n.nx <= o.x + o.w && n.ny >= o.y && n.ny <= o.y + o.h,
    );
    if (!hit || hit.id == null) {
      setStatus("Tap a box to pin, ignore, or name it.");
      return;
    }
    setTeach({ id: hit.id, class: hit.class });
    setTeachName(hit.name || (hit.color ? `${hit.color} ${hit.class}` : ""));
    setStatus(`#${hit.id} ${hit.color ? hit.color + " " : ""}${hit.class} — pin, ignore, or name it.`);
  }

  async function saveTeach() {
    const f = frameRef.current;
    const src = live ? videoRef.current : imageRef.current;
    if (!teach || !f || !src || !teachName.trim()) return;
    const box = f.objects.find((o) => o.id === teach.id);
    if (!box) return;
    const vec = await embedCrop(src, box);
    if (vec) teachObject(teachName.trim(), vec, box.class);
    rememberName(teach.id, teachName.trim());
    setSeekState(teachName.trim());
    setSeek(teachName.trim());
    setStatus(`Remembered “${teachName.trim()}” — I can find it by name.`);
    setTeach(null);
  }

  const tally = frame ? counts(frame.objects) : [];
  const slot = backendNote();

  useEffect(() => {
    const c = mapRef.current;
    if (!c) return;
    c.width = 320;
    c.height = 200;
    drawRoom(c, seek || undefined, frame?.occupancy);
  }, [frame, seek]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <a href={backHref} className="text-sm text-muted hover:text-fg">
          Back
        </a>
        <p className="font-display text-lg">Aether · Eyes</p>
        <p className="text-xs text-muted">{status}</p>
        <p className="hidden text-[10px] text-muted sm:block">{missLine()}</p>
      </header>
      <div className="grid flex-1 lg:grid-cols-12">
        <div className="relative bg-black lg:col-span-8">
          <video ref={videoRef} className="hidden" playsInline muted />
          <img ref={imageRef} alt="" className="hidden" />
          <canvas
            ref={canvasRef}
            className="mx-auto max-h-[70dvh] w-full cursor-crosshair object-contain lg:max-h-[calc(100dvh-3.5rem)]"
            onClick={onCanvasClick}
          />
          {!frame ? (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
              Start the camera or open a photo. Ask Ae what it sees. Boxes are classes, not names.
            </p>
          ) : null}
        </div>
        <aside className="flex flex-col gap-5 border-t border-border p-4 lg:col-span-4 lg:border-l lg:border-t-0">
          <div className="flex flex-wrap gap-2">
            {live ? (
              <Button size="sm" variant="outline" onClick={stopCamera}>
                Stop camera
              </Button>
            ) : (
              <Button size="sm" onClick={() => void startCamera()} disabled={!ready}>
                Start camera
              </Button>
            )}
            <Button
              size="sm"
              variant={torchOn ? "default" : "outline"}
              disabled={!live}
              onClick={() => {
                const on = !torchOn;
                setTorchOn(on);
                const stream = videoRef.current?.srcObject as MediaStream | null;
                const track = stream?.getVideoTracks()[0];
                void track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => setStatus("Torch not supported on this camera."));
              }}
            >
              Torch {torchOn ? "on" : "off"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={!ready}>
              Detect a photo
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready}
              onClick={() => void loadSample("/media/brain/dog-1.jpg")}
            >
              Try a dog
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready}
              onClick={() => void loadSample("/media/brain/fish-4.jpg")}
            >
              Try a fish
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready}
              onClick={() => void loadSample("/media/brain/room.jpg")}
            >
              Try a room
            </Button>
            <Button
              size="sm"
              variant={recording ? "default" : "outline"}
              onClick={() => {
                if (recording) {
                  stopSession();
                  setRecording(false);
                  setStatus(`Stopped. ${sessionCount()} frames in this run.`);
                } else {
                  startSession();
                  setRecording(true);
                  setClips(0);
                  setStatus("Recording. IDs, pins, and path go into the session.");
                }
              }}
            >
              {recording ? `Stop rec · ${clips}` : "Record run"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!clips && !sessionCount()}
              onClick={() => {
                const blob = new Blob([sessionJson()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "aether-run.json";
                a.click();
                setStatus("Session exported.");
              }}
            >
              Export run
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void chartPack().then((p) => setStatus(`Chart pack ${p.hash.slice(0, 8)}…`));
              }}
            >
              Chart pack
            </Button>
            <Button size="sm" variant="outline" onClick={() => cocoExport()}>
              COCO
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void import("@/vision/mavlink").then((m) => {
                  m.downloadMavlink();
                  setStatus("MAVLink JSON saved.");
                });
              }}
            >
              MAVLink
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-xs">
              Import FieldVault
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void f.text().then(async (t) => {
                    try {
                      const n = await importFieldVault(JSON.parse(t));
                      setStatus(`Imported ${n} FieldVault rows into the walkdown.`);
                    } catch {
                      setStatus("Not a FieldVault JSON.");
                    }
                  });
                }}
              />
            </label>
            <a href="/apps/aether/verify" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs">
              Verify hash
            </a>
            <Button size="sm" variant="outline" onClick={() => geoJsonExport()}>
              GeoJSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const p = getPose();
                addWaypoint("home", p.x, p.y, "home");
                setStatus("Home set on the sketch.");
              }}
            >
              Set home
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void zipPack().then((p) => setStatus(`Zip pack ${p.hash.slice(0, 8)}…`));
              }}
            >
              Zip pack
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadFloorplan()}>
              Floorplan
            </Button>
            <Button size="sm" variant="outline" onClick={() => fieldVaultRow()}>
              FieldVault row
            </Button>
            <Button size="sm" variant="outline" onClick={() => fieldVaultWalk()}>
              FieldVault walk
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const p = getPose();
                addWaypoint("nogo", p.x, p.y, "nogo");
                setStatus("No-go at this pose.");
              }}
            >
              No-go here
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const ids = (frameRef.current?.objects || []).map((o) => o.id).filter((id): id is number => id != null);
                if (ids.length < 2) {
                  setStatus("Need two IDs to merge.");
                  return;
                }
                mergeTracks(ids[0], ids[1]);
                setStatus(`Merged #${ids[1]} into #${ids[0]}.`);
              }}
            >
              Merge last two IDs
            </Button>
            <Button
              size="sm"
              variant={paintNogo ? "default" : "outline"}
              onClick={() => setPaintNogo((v) => !v)}
            >
              No-go brush
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void joinMesh(prompt("Room code") || "eyes").then(() => setStatus(`Mesh ${meshPeers()} peers.`))}
            >
              Join mesh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const c = canvasRef.current;
                if (!c) return;
                startWebm(c);
                setStatus("WebM recording.");
              }}
            >
              WebM
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void stopWebm().then((blob) => {
                  if (blob) downloadWebm(blob);
                  vttExport();
                  setStatus("WebM + VTT saved.");
                });
              }}
            >
              Stop WebM
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!sessionCount()}
              onClick={() => {
                const clips = sessionClips();
                if (!clips.length) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                setStatus(`Replaying ${clips.length} frames, ${sessionStills()} stills.`);
                let i = 0;
                const fallback = live ? videoRef.current : imageRef.current;
                const tick = () => {
                  const snap = clips[i++];
                  if (!snap) {
                    setStatus("Replay done.");
                    return;
                  }
                  const fake: Frame = {
                    t: snap.t,
                    w: canvas.width,
                    h: canvas.height,
                    objects: snap.objects.map((o) => ({
                      class: o.class,
                      name: o.name,
                      score: o.score,
                      x: o.x,
                      y: o.y,
                      w: o.w,
                      h: o.h,
                      id: o.id,
                      pinned: o.pinned,
                      layer: o.layer === "bg" ? "bg" : "must",
                      bearing:
                        o.bearing === "left" || o.bearing === "right" || o.bearing === "ahead" ? o.bearing : undefined,
                      range: o.range === "near" || o.range === "mid" || o.range === "far" ? o.range : undefined,
                    })),
                    block: false,
                    seek: snap.seek,
                    seekId: snap.seekId,
                  };
                  const go = (src: HTMLVideoElement | HTMLImageElement) => {
                    if ("naturalWidth" in src && src.naturalWidth) {
                      canvas.width = src.naturalWidth;
                      canvas.height = src.naturalHeight;
                    } else if ("videoWidth" in src && src.videoWidth) {
                      canvas.width = src.videoWidth;
                      canvas.height = src.videoHeight;
                    }
                    draw(canvas, src, fake, snap.seek);
                    window.setTimeout(tick, 160);
                  };
                  if (snap.img) {
                    const im = new Image();
                    im.onload = () => go(im);
                    im.src = snap.img;
                  } else if (fallback) {
                    go(fallback);
                  } else {
                    window.setTimeout(tick, 160);
                  }
                };
                tick();
              }}
            >
              Replay
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Watch for</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FILTER_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFilter(id);
                  }}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs capitalize",
                    filter === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted hover:text-fg",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Must track</p>
            <p className="mt-1 text-[11px] text-muted">Always on the HUD. Background stays dim.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ["", "anything"],
                ["person", "people"],
                ["dog", "dogs"],
                ["cat", "cats"],
                ["car", "cars"],
                ["truck", "trucks"],
                ["bus", "buses"],
                ["motorcycle", "bikes"],
                ["bird", "birds"],
                ["horse", "horses"],
                ["chair", "chairs"],
              ].map(([id, label]) => (
                <button
                  key={id || "any"}
                  type="button"
                  onClick={() => {
                    if (!id) {
                      setWatchState([]);
                      setWatch([]);
                      return;
                    }
                    const next = watch.includes(id) ? watch.filter((w) => w !== id) : [...watch, id];
                    setWatchState(next);
                    setWatch(next);
                    setFilter("all");
                  }}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs",
                    (!id && watch.length === 0) || (id && watch.includes(id))
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Background</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ["none", "none"],
                  ["furniture", "furniture"],
                  ["all", "everything else"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setBg(id);
                    setBackground(id);
                  }}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs",
                    bg === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Find in scene</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["", "person", "dog", "cat", "car", "truck", "bus", "chair", "remote", "bottle"].map((id) => (
                <button
                  key={id || "none"}
                  type="button"
                  onClick={() => {
                    setSeekState(id);
                    setSeek(id || undefined);
                    if (id) setFilter("all");
                  }}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs",
                    (id === "" && !seek) || seek === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted hover:text-fg",
                  )}
                >
                  {id || "any"}
                </button>
              ))}
            </div>
          </div>
          {teach ? (
            <div className="flex flex-col gap-2 rounded-md border border-border p-2">
              <p className="text-xs text-muted">
                #{teach.id} {teach.class}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    pinTrack(teach.id);
                    setSeekId(teach.id);
                    setSeekState(teach.class);
                    setSeek(teach.class);
                    setStatus(`Target #${teach.id}. Craft will follow that box, not the class.`);
                    setTeach(null);
                  }}
                >
                  Target
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    pinTrack(teach.id);
                    setStatus(`Pinned #${teach.id}. It keeps that ID.`);
                    setTeach(null);
                  }}
                >
                  Pin
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const box = frameRef.current?.objects.find((o) => o.id === teach.id);
                    if (box) ignoreBox(box);
                    setStatus(`Ignored #${teach.id}. Not a thing.`);
                    setTeach(null);
                  }}
                >
                  Not a thing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const box = frameRef.current?.objects.find((o) => o.id === teach.id);
                    if (box) notThis(box);
                    setStatus(`Not a ${teach.class} here.`);
                    setTeach(null);
                  }}
                >
                  Not this class
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={teachName}
                  onChange={(e) => setTeachName(e.target.value)}
                  placeholder="blue chair, pump 4"
                  className="h-9 min-w-[8rem] flex-1 rounded-md border border-border bg-elevated px-2 text-sm"
                />
                <Button size="sm" onClick={() => void saveTeach()}>
                  Remember
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTeach(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">Tap a box: pin it, mark not a thing, or name it.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn("h-9 rounded-md border px-3 text-xs", voiceOn ? "border-primary text-primary" : "border-border text-muted")}
              onClick={() => {
                const next = !voiceOn;
                setVoiceOn(next);
                setCallouts(next);
                if (!next) resetAnnounced();
              }}
            >
              Callouts {voiceOn ? "on" : "off"}
            </button>
            <button
              type="button"
              className="h-9 rounded-md border border-border px-3 text-xs text-muted"
              onClick={() => {
                const f = frameRef.current;
                const r = calibrateFrom(f?.objects || []);
                setStatus(
                  r.ghosts
                    ? `Calibrated. ${r.ghosts} ghosts ignored. Floor ${Math.round(r.floor * 100)}%. Point at an empty scene next time for a cleaner floor.`
                    : `Calibrated empty. Floor ${Math.round(r.floor * 100)}%.`,
                );
              }}
            >
              Calibrate empty
            </button>
            <button
              type="button"
              className="h-9 rounded-md border border-border px-3 text-xs text-muted"
              onClick={() => {
                clearMarks();
                resetTracks(true);
                clearRoom();
                clearSession();
                setRecording(false);
                setClips(0);
                setStatus("Marks, IDs, map, and session cleared.");
              }}
            >
              Clear marks
            </button>
          </div>
          <label className="text-xs text-muted">
            Confidence {Math.round(minScore * 100)}%
            <input
              type="range"
              min={0.12}
              max={0.85}
              step={0.05}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">This frame</p>
            <p className={cn("mt-2 font-display text-2xl", frame?.block ? "text-primary" : "text-fg")}>
              {frame?.block ? "Path blocked" : "Path clear"}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {tally.length ? tally.map(([c, n]) => (
                <li key={c}>
                  {n} {c}
                </li>
              )) : <li>No objects above threshold.</li>}
            </ul>
            {frame?.objects.some((o) => o.id != null) ? (
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {frame.objects.slice(0, 10).map((o) => (
                  <li key={o.id ?? `${o.class}-${o.x}`}>
                    {o.id != null ? `#${o.id} ` : ""}
                    {[o.color, o.name || o.class, o.grasp?.cue, o.bearing, o.meters != null ? `${o.meters}m` : o.range, o.layer === "bg" ? "bg" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    {o.stable ? " · lock" : o.coasting ? " · coast" : ""} · Q{Math.round((o.quality ?? o.score) * 100)}
                  </li>
                ))}
              </ul>
            ) : null}
            {frame?.pose ? (
              <p className="mt-2 text-xs text-muted">
                Pose {frame.pose.x.toFixed(1)}, {frame.pose.y.toFixed(1)} · yaw {(frame.pose.yaw * 180 / Math.PI).toFixed(0)}°
              </p>
            ) : null}
            {frame?.objects[0]?.grasp ? (
              <p className="mt-2 text-xs text-muted">
                Grasp {frame.objects.find((o) => o.grasp)?.grasp?.cue} · {frame.objects.find((o) => o.grasp)?.grasp?.side}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Sketch chart</p>
            <canvas
              ref={mapRef}
              className="mt-2 w-full cursor-crosshair rounded-md border border-border"
              onClick={(e) => {
                const c = mapRef.current;
                if (!c) return;
                const r = c.getBoundingClientRect();
                const pt = canvasToWorld(
                  ((e.clientX - r.left) / r.width) * c.width,
                  ((e.clientY - r.top) / r.height) * c.height,
                  c.width,
                  c.height,
                );
                if (paintNogo) {
                  addWaypoint("nogo", pt.wx, pt.wy, "nogo");
                  setStatus("No-go cell.");
                  return;
                }
                if (!tape.current) {
                  tape.current = pt;
                  setStatus("Tape: tap the other point.");
                  return;
                }
                const dx = pt.wx - tape.current.wx;
                const dy = pt.wy - tape.current.wy;
                const units = Math.hypot(dx, dy);
                const m = metersPerUnit();
                tape.current = null;
                setStatus(m ? `Tape ${ (units * m).toFixed(2) } m.` : `Tape ${units.toFixed(2)} units. Set door scale first.`);
              }}
            />
            <p className="mt-1 text-[11px] text-muted">
              Quiet watch {voiceOn ? "on" : "off"}. Sound {lastSound().label}. Mesh {meshPeers()}. Tap sketch for tape or no-go brush.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {roomList()
                .slice(0, 6)
                .map((m) => (
                  <li key={m.id}>
                    #{m.id} {m.name || m.class}
                    {m.missing > 3 ? " (last seen)" : ""} {m.bearing} {m.range}
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted">Autonomy payload</p>
              <button
                type="button"
                className="text-xs text-primary disabled:text-muted"
                disabled={!frame}
                onClick={copyPayload}
              >
                Copy JSON
              </button>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-elevated p-3 font-mono text-[11px] leading-relaxed text-muted">
              {frame
                ? JSON.stringify(
                    {
                      t: frame.t,
                      block: frame.block,
                      ms: frame.ms,
                      backend: frame.backend,
                      models: frame.models,
                      watch: frame.watch,
                      occupancy: frame.occupancy
                        ? { cells: frame.occupancy.blocked.filter(Boolean).length, path: frame.occupancy.path.length }
                        : undefined,
                      objects: frame.objects.map((o) => ({
                        id: o.id,
                        class: o.class,
                        name: o.name,
                        score: Number(o.score.toFixed(2)),
                        bearing: o.bearing,
                        range: o.range,
                        depth: o.depth,
                        color: o.color,
                        pinned: o.pinned,
                        x: Number(o.x.toFixed(3)),
                        y: Number(o.y.toFixed(3)),
                        w: Number(o.w.toFixed(3)),
                        h: Number(o.h.toFixed(3)),
                      })),
                    },
                    null,
                    2,
                  )
                : "// start camera or open a photo"}
            </pre>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Detector {slot.active}. MoveNet stance, BlazeFace count, IMU yaw. Chart pack / COCO / GeoJSON. Set home.
          </p>
        </aside>
      </div>
    </div>
  );
}
