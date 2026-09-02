"use client";

import { useEffect, useRef } from "react";
import type { AgentId } from "@/aether/brain/bank";
import { snapshot, brainTrace, recall } from "@/aether/brain/world";

const NODES: { id: AgentId; label: string; w: number; ang: number; rad: number; rgb: [number, number, number] }[] = [
  { id: "eyes", label: "eyes", w: 1, ang: -1.72, rad: 0.62, rgb: [72, 168, 176] },
  { id: "craft", label: "craft", w: 0.92, ang: -0.95, rad: 0.7, rgb: [212, 160, 84] },
  { id: "life", label: "life", w: 0.88, ang: 0.28, rad: 0.66, rgb: [196, 92, 74] },
  { id: "memory", label: "memory", w: 0.74, ang: 2.05, rad: 0.78, rgb: [138, 122, 176] },
  { id: "map", label: "map", w: 0.7, ang: -2.35, rad: 0.88, rgb: [72, 168, 176] },
  { id: "brief", label: "brief", w: 0.64, ang: 1.35, rad: 0.58, rgb: [138, 122, 176] },
  { id: "safety", label: "safety", w: 0.6, ang: -0.42, rad: 0.92, rgb: [196, 92, 74] },
  { id: "comms", label: "comms", w: 0.55, ang: 0.72, rad: 0.9, rgb: [196, 92, 74] },
  { id: "nav", label: "nav", w: 0.5, ang: 0.08, rad: 0.98, rgb: [212, 160, 84] },
  { id: "watch", label: "watch", w: 0.48, ang: 2.55, rad: 0.95, rgb: [72, 168, 176] },
  { id: "time", label: "time", w: 0.4, ang: 1.78, rad: 1.05, rgb: [138, 122, 176] },
  { id: "export", label: "export", w: 0.36, ang: -2.85, rad: 1.08, rgb: [154, 149, 140] },
  { id: "weather", label: "weather", w: 0.3, ang: 3.05, rad: 1.12, rgb: [88, 140, 108] },
  { id: "help", label: "help", w: 0.26, ang: 2.28, rad: 1.16, rgb: [154, 149, 140] },
];

function rgba(rgb: [number, number, number], a: number) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function pos(n: (typeof NODES)[0], cx: number, cy: number, R: number, t: number) {
  const drift = Math.sin(t * 0.35 + n.ang * 3) * 6 * (1.1 - n.w);
  const spin = t * 0.012 * (0.4 + (1 - n.w));
  const ang = n.ang + spin;
  const r = R * n.rad + drift;
  return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, r, ang };
}

export function AetherMind() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const sparks: { i: number; u: number }[] = [];

    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, box.width) * dpr;
      canvas.height = Math.max(240, box.height) * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const tick = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      t += 0.016;
      ctx.fillStyle = "#0c0c0d";
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.48;
      const cy = h * 0.5;
      const R = Math.min(w, h) * 0.34;
      const world = snapshot();
      const last = brainTrace()[0];
      const mem = recall();
      const live = (last?.agent as AgentId) || (mem.agent as AgentId) || null;

      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, R * 1.35);
      g.addColorStop(0, "rgba(212,160,84,0.07)");
      g.addColorStop(0.45, "rgba(72,168,176,0.04)");
      g.addColorStop(1, "rgba(12,12,13,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (Math.random() < 0.05) {
        const heavy = NODES.map((n, i) => ({ i, p: n.w * n.w })).sort((a, b) => b.p - a.p);
        const pick = Math.random() < 0.65 ? heavy[Math.floor(Math.random() * 4)].i : Math.floor(Math.random() * NODES.length);
        sparks.push({ i: pick, u: 0 });
      }
      if (live) {
        const i = NODES.findIndex((n) => n.id === live);
        if (i >= 0 && Math.random() < 0.1) sparks.push({ i, u: 0 });
      }

      NODES.forEach((n) => {
        const p = pos(n, cx, cy, R, t);
        const on = n.id === live;
        ctx.strokeStyle = rgba(n.rgb, on ? 0.45 : 0.1 + n.w * 0.12);
        ctx.lineWidth = 0.6 + n.w * 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });

      for (const s of sparks) {
        s.u += 0.016 + NODES[s.i].w * 0.01;
        const n = NODES[s.i];
        const p = pos(n, cx, cy, R, t);
        const x = cx + (p.x - cx) * s.u;
        const y = cy + (p.y - cy) * s.u;
        ctx.fillStyle = rgba(n.rgb, 1 - s.u);
        ctx.beginPath();
        ctx.arc(x, y, 1.4 + n.w * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].u >= 1) sparks.splice(i, 1);

      const core = 40;
      ctx.fillStyle = "#141416";
      ctx.beginPath();
      ctx.ellipse(cx, cy, core * 1.15, core, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(212,160,84,0.7)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = "#d4a054";
      ctx.font = "600 12px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CORTEX", cx, cy - 5);
      ctx.fillStyle = "#9a958c";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.fillText("weighted mind", cx, cy + 11);

      const drawn = NODES.map((n) => ({ n, p: pos(n, cx, cy, R, t) })).sort((a, b) => a.n.w - b.n.w);
      for (const { n, p } of drawn) {
        const on = n.id === live;
        const rad = 5 + n.w * 14 + (on ? 3 : 0);
        ctx.fillStyle = on ? rgba(n.rgb, 0.95) : rgba(n.rgb, 0.14 + n.w * 0.12);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(n.rgb, on ? 0.95 : 0.35 + n.w * 0.25);
        ctx.lineWidth = n.w > 0.7 ? 1.4 : 1;
        ctx.stroke();
        ctx.fillStyle = on ? "#0c0c0d" : rgba(n.rgb, 0.85);
        ctx.font = `${n.w > 0.7 ? 600 : 500} ${10 + n.w * 4}px ui-sans-serif, system-ui`;
        ctx.fillText(n.label, p.x, p.y + rad + 9);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#9a958c";
      ctx.font = "10px ui-sans-serif, system-ui";
      const see = world.objects.slice(0, 4).join(" · ") || "eyes dark";
      ctx.fillText(see, 14, h - 28);
      ctx.fillText(`${world.hull} hull · ${world.list} list · ${world.openTasks} tasks`, 14, h - 14);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-[#0c0c0d]">
      <canvas ref={ref} className="block aspect-[16/10] w-full" />
      <p className="pointer-events-none absolute top-3 left-4 text-[10px] uppercase tracking-[0.18em] text-muted">
        Mind
      </p>
    </div>
  );
}
