"use client";

import { useEffect, useRef, useState } from "react";
import {
  AU_KM,
  BODIES,
  C_KM_S,
  SPEEDS,
  WARPS,
  auOf,
  formatDuration,
  formatKm,
  kmOf,
  lightSeconds,
  type Body,
} from "./bodies";
import { takePending, type Cmd } from "@/aether/bus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Ping = { born: number; fromKm: number } | null;

type Sim = {
  xKm: number;
  kmPerPx: number;
  speedId: (typeof SPEEDS)[number]["id"];
  warpId: (typeof WARPS)[number]["id"];
  cheat: boolean;
  dir: number;
  keys: Set<string>;
  ping: Ping;
  pingBack: boolean;
  pbd: boolean;
  last: number;
};

const EARTH = kmOf(1);
const MIN_X = 0;
const MAX_X = kmOf(180);

function mapKm(km: number, cheat: boolean) {
  if (!cheat) return km;
  const au = Math.max(0, km) / AU_KM;
  return Math.log1p(au * 12) * AU_KM * 0.22;
}

function nearestBody(xKm: number) {
  let best = BODIES[0];
  let bestD = Infinity;
  for (const b of BODIES) {
    const d = Math.abs(kmOf(b.au) - xKm);
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return { body: best, d: bestD };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function beep(freq: number, dur = 0.12) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  } catch {
    /* ignore */
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}

export function SpaceWalk({ backHref }: { backHref?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState({
    au: 1,
    km: EARTH,
    lag: lightSeconds(0),
    near: "Earth",
    note: BODIES.find((b) => b.id === "earth")!.note,
    cheat: false,
    speedId: "voyager" as Sim["speedId"],
    warpId: "6" as Sim["warpId"],
    ping: "Radio silent",
    pbd: false,
    scale: "",
    empty: true,
  });

  useEffect(() => {
    const sim: Sim = {
      xKm: EARTH,
      kmPerPx: 90,
      speedId: "voyager",
      warpId: "6",
      cheat: false,
      dir: 0,
      keys: new Set(),
      ping: null,
      pingBack: false,
      pbd: false,
      last: 0,
    };
    simRef.current = sim;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let hudAcc = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.repeat) return;
      if (down) sim.keys.add(e.code);
      else sim.keys.delete(e.code);
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    const blur = () => sim.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      sim.kmPerPx = Math.min(AU_KM * 2, Math.max(0.0008, sim.kmPerPx * f));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    window.__controlsTest = {
      getYaw: () => 0,
      getSpeed: () => {
        const sp = SPEEDS.find((s) => s.id === sim.speedId)!;
        const w = WARPS.find((w) => w.id === sim.warpId)!;
        return sim.dir * sp.kmPerS * w.n;
      },
      getX: () => sim.xKm,
      setKeys: (codes) => {
        sim.keys = new Set(codes);
      },
    };

    const loop = (t: number) => {
      const dt = Math.min(0.1, sim.last ? (t - sim.last) / 1000 : 0.016);
      sim.last = t;

      let dir = 0;
      if (sim.keys.has("KeyA") || sim.keys.has("ArrowLeft")) dir -= 1;
      if (sim.keys.has("KeyD") || sim.keys.has("ArrowRight")) dir += 1;
      sim.dir = dir;

      const sp = SPEEDS.find((s) => s.id === sim.speedId)!;
      const w = WARPS.find((x) => x.id === sim.warpId)!;
      sim.xKm += dir * sp.kmPerS * w.n * dt;
      sim.xKm = Math.min(MAX_X, Math.max(MIN_X, sim.xKm));

      const au = auOf(sim.xKm);
      if (au > 39.8 && au < 48) sim.pbd = true;

      if (sim.ping) {
        const age = (t - sim.ping.born) / 1000;
        const reach = C_KM_S * age * w.n;
        const path = Math.abs(sim.ping.fromKm - EARTH) * 2;
        if (reach >= path && !sim.pingBack) {
          sim.pingBack = true;
          beep(220, 0.18);
        }
        if (reach >= path * 1.05) {
          sim.ping = null;
          sim.pingBack = false;
        }
      }

      draw(ctx, canvas, sim, t);
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        const near = nearestBody(sim.xKm);
        const earthKm = Math.abs(sim.xKm - EARTH);
        const barPx = 72;
        setHud({
          au,
          km: sim.xKm,
          lag: lightSeconds(earthKm),
          near: near.body.name,
          note: near.body.note,
          cheat: sim.cheat,
          speedId: sim.speedId,
          warpId: sim.warpId,
          ping: sim.ping
            ? sim.pingBack
              ? "Return on the way"
              : "Outbound to Earth"
            : "Radio silent",
          pbd: sim.pbd && au > 38,
          scale: `${formatKm(sim.kmPerPx * barPx)} across that bar`,
          empty: sim.kmPerPx > 400,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("wheel", onWheel);
      delete window.__controlsTest;
    };
  }, []);

  useEffect(() => {
    function apply(d: Cmd) {
      const sim = simRef.current;
      if (!sim || !d?.type) return;
      if (d.type === "start") setStarted(true);
      if (d.type === "jump" && d.body) {
        const b = BODIES.find((x) => x.id === d.body);
        if (b) {
          sim.xKm = kmOf(b.au);
          const r = Math.max(b.radiusKm, 40);
          sim.kmPerPx = r / 48;
          if (b.id === "pbd" || b.id === "heliopause") sim.kmPerPx = AU_KM / 90;
          if (b.id === "voyager1") sim.kmPerPx = 0.02;
          setStarted(true);
        }
      }
      if (d.type === "ping") {
        if (!sim.ping) {
          sim.ping = { born: performance.now(), fromKm: sim.xKm };
          sim.pingBack = false;
          beep(640, 0.1);
        }
        setStarted(true);
      }
      if (d.type === "cheat") sim.cheat = Boolean(d.on);
      if (d.type === "speed" && d.id) {
        sim.speedId = d.id as Sim["speedId"];
      }
      if (d.type === "warp" && d.id) {
        sim.warpId = d.id as Sim["warpId"];
      }
      if (d.type === "query") {
        window.dispatchEvent(
          new CustomEvent("aether:sim", {
            detail: { km: sim.xKm, cheat: sim.cheat },
          }),
        );
      }
    }
    function onCmd(ev: Event) {
      apply((ev as CustomEvent).detail as Cmd);
    }
    window.addEventListener("aether:cmd", onCmd);
    const pending = takePending();
    if (pending) apply(pending);
    return () => window.removeEventListener("aether:cmd", onCmd);
  }, []);

  function jump(b: Body) {
    const sim = simRef.current;
    if (!sim) return;
    sim.xKm = kmOf(b.au);
    const r = Math.max(b.radiusKm, 40);
    sim.kmPerPx = r / 48;
    if (b.id === "pbd" || b.id === "heliopause") sim.kmPerPx = AU_KM / 90;
    if (b.id === "voyager1") sim.kmPerPx = 0.02;
  }

  function ping() {
    const sim = simRef.current;
    if (!sim || sim.ping) return;
    sim.ping = { born: performance.now(), fromKm: sim.xKm };
    sim.pingBack = false;
    beep(640, 0.1);
  }

  function hold(code: string, on: boolean) {
    const sim = simRef.current;
    if (!sim) return;
    if (on) sim.keys.add(code);
    else sim.keys.delete(code);
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="True-scale solar system"
      />

      {!started ? (
        <div className="absolute inset-0 z-20 flex items-end bg-bg/80 sm:items-center">
          <div className="mx-auto w-full max-w-lg px-5 pb-24 pt-16 sm:pb-0">
            {backHref ? (
              <a href={backHref} className="mb-6 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
                Back to studio
              </a>
            ) : null}
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              A walk through nothing
            </p>
            <h1 className="mt-3 font-display text-5xl tracking-tight text-fg sm:text-6xl">
              Empty Stretch
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The solar system at true scale. Planets vanish. Light takes minutes.
              A ping to Earth has to wait.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li>
                <span className="text-fg">True scale.</span> Zoom out and Earth is
                a speck. Zoom in and the next planet is gone.
              </li>
              <li>
                <span className="text-fg">Light-lag.</span> How old is the picture
                of home.
              </li>
              <li>
                <span className="text-fg">Radio ping.</span> Send a call. Wait the
                real round trip (warped so you can finish it).
              </li>
              <li>
                <span className="text-fg">Pale Blue Dot.</span> Cross 40.5 AU.
              </li>
            </ul>
            <Button className="mt-8" size="lg" onClick={() => setStarted(true)}>
              Start at Earth
            </Button>
            <p className="mt-4 text-xs text-muted">
              A / D or arrows to move. Scroll to zoom. Sun is to the left.
            </p>
          </div>
        </div>
      ) : null}

      {started ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4 sm:p-5">
            <div className="pointer-events-auto mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {backHref ? (
                  <a
                    href={backHref}
                    className="mb-2 inline-flex text-xs text-muted hover:text-fg"
                  >
                    Exit
                  </a>
                ) : null}
                <p className="font-display text-2xl text-fg">{formatKm(hud.km)}</p>
                <p className="mt-1 text-sm text-muted">
                  Light to Earth {formatDuration(hud.lag)} · round trip{" "}
                  {formatDuration(hud.lag * 2)}
                  {hud.ping !== "Radio silent" ? ` · ${hud.ping}` : ""}
                </p>
              </div>
              <div className="max-w-sm rounded-xl border border-border bg-surface/90 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Near {hud.near}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-fg">{hud.note}</p>
                {hud.empty ? (
                  <p className="mt-2 text-xs text-muted">
                    If you cannot see a planet, that is the point. Zoom, or jump.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {hud.pbd ? (
            <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 px-6 text-center">
              <p className="font-display text-xl text-fg sm:text-2xl">
                A pale blue dot
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                That is home. Everyone you ever heard of, on a mote of dust
                suspended in a sunbeam.
              </p>
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 z-10 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {BODIES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => jump(b)}
                    className="h-10 shrink-0 rounded-md border border-border bg-surface px-3 text-xs text-fg"
                  >
                    {b.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/95 p-2 sm:flex-row sm:items-center sm:justify-between sm:p-3">
                <div className="flex flex-wrap gap-1">
                  {SPEEDS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (simRef.current) simRef.current.speedId = s.id;
                      }}
                      className={cn(
                        "h-10 rounded-md px-2.5 text-xs sm:px-3",
                        hud.speedId === s.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted hover:text-fg",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {WARPS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        if (simRef.current) simRef.current.warpId = w.id;
                      }}
                      className={cn(
                        "h-10 rounded-md px-2.5 font-mono text-xs sm:px-3",
                        hud.warpId === w.id
                          ? "bg-elevated text-fg"
                          : "text-muted hover:text-fg",
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-12 w-14 rounded-lg border border-border bg-elevated text-lg text-fg"
                    onPointerDown={() => hold("KeyA", true)}
                    onPointerUp={() => hold("KeyA", false)}
                    onPointerLeave={() => hold("KeyA", false)}
                    aria-label="Toward the Sun"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="h-12 w-14 rounded-lg border border-border bg-elevated text-lg text-fg"
                    onPointerDown={() => hold("KeyD", true)}
                    onPointerUp={() => hold("KeyD", false)}
                    onPointerLeave={() => hold("KeyD", false)}
                    aria-label="Outward"
                  >
                    →
                  </button>
                </div>
                <p className="hidden text-xs text-muted lg:block">{hud.scale}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const s = simRef.current;
                      if (s) s.cheat = !s.cheat;
                    }}
                  >
                    {hud.cheat ? "True scale" : "Compress (lie)"}
                  </Button>
                  <Button size="sm" onClick={ping}>
                    Ping Earth
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sim: Sim,
  t: number,
) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = "#07080a";
  ctx.fillRect(0, 0, w, h);

  const cam = mapKm(sim.xKm, sim.cheat);
  const toX = (km: number) => (mapKm(km, sim.cheat) - cam) / sim.kmPerPx + w / 2;
  const toR = (rKm: number) => rKm / sim.kmPerPx;

  for (let i = 0; i < 140; i++) {
    const px = ((hash(i) * w * 4 + t * 0.003 * (hash(i + 3) - 0.5)) % (w + 40)) - 20;
    const py = hash(i + 9) * h;
    const a = 0.15 + hash(i + 2) * 0.5;
    ctx.fillStyle = `rgba(197,205,216,${a})`;
    ctx.fillRect(px, py, hash(i + 5) > 0.92 ? 2 : 1, 1);
  }

  const y = h * 0.46;
  ctx.strokeStyle = "rgba(197,205,216,0.12)";
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();

  for (const b of BODIES) {
    const x = toX(kmOf(b.au));
    const r = toR(b.radiusKm);
    if (x < -400 || x > w + 400) continue;

    if (b.id === "sun") {
      const R = Math.max(r, 2);
      const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 2.4);
      g.addColorStop(0, "rgba(232,220,192,0.95)");
      g.addColorStop(0.35, "rgba(232,220,192,0.55)");
      g.addColorStop(1, "rgba(232,220,192,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.fill;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(R, 1.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === "edge") {
      ctx.strokeStyle = "rgba(197,205,216,0.28)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(x, y - 28);
      ctx.lineTo(x, y + 28);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (b.kind === "probe") {
      ctx.fillStyle = b.fill;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    } else {
      if (b.id === "saturn" && r > 3) {
        ctx.strokeStyle = "rgba(210,196,166,0.45)";
        ctx.lineWidth = Math.max(1, r * 0.15);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2.1, r * 0.45, -0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (r < 0.7) {
        ctx.fillStyle = b.fill;
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      } else {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, b.fill);
        g.addColorStop(1, "rgba(7,8,10,0.85)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const label = r > 6 || Math.abs(x - w / 2) < 80;
    if (label && b.id !== "sun") {
      ctx.fillStyle = "rgba(232,234,238,0.75)";
      ctx.font = "12px IBM Plex Sans, sans-serif";
      ctx.fillText(b.name, x + 8, y - Math.max(r, 8) - 6);
    }
  }

  if (sim.ping) {
    const age = (t - sim.ping.born) / 1000;
    const wrp = WARPS.find((x) => x.id === sim.warpId)!;
    const reach = C_KM_S * age * wrp.n;
    const from = sim.ping.fromKm;
    const towardEarth = EARTH >= from ? 1 : -1;
    const path = Math.abs(from - EARTH);
    let pulseKm = from + towardEarth * Math.min(reach, path);
    if (reach > path) {
      pulseKm = EARTH - towardEarth * Math.min(reach - path, path);
    }
    const px = toX(pulseKm);
    ctx.strokeStyle = "rgba(197,205,216,0.7)";
    ctx.beginPath();
    ctx.arc(px, y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#c5cdd8";
  ctx.beginPath();
  ctx.moveTo(w / 2 + 7, y);
  ctx.lineTo(w / 2 - 5, y - 5);
  ctx.lineTo(w / 2 - 5, y + 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(139,144,154,0.9)";
  ctx.font = "11px IBM Plex Sans, sans-serif";
  ctx.fillText("you", w / 2 - 8, y + 22);

  const bar = 72;
  ctx.strokeStyle = "rgba(197,205,216,0.45)";
  ctx.beginPath();
  ctx.moveTo(16, h - 18);
  ctx.lineTo(16 + bar, h - 18);
  ctx.stroke();
}
