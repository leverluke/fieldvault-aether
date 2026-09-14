"use client";

import { useEffect, useRef } from "react";
import { snapshot } from "@/aether/brain/world";
import { loadOperator, liveMemories } from "@/aether/operator";

type NodeId = "talk" | "memory" | "plan" | "skill" | "draft" | "confirm" | "lesson" | "body";

const NODES: {
  id: NodeId;
  label: string;
  w: number;
  ang: number;
  rad: number;
  rgb: [number, number, number];
}[] = [
  { id: "talk", label: "talk", w: 1, ang: -1.85, rad: 0.58, rgb: [212, 160, 84] },
  { id: "memory", label: "memory", w: 0.95, ang: -0.95, rad: 0.68, rgb: [138, 122, 176] },
  { id: "plan", label: "plan", w: 0.9, ang: -0.15, rad: 0.72, rgb: [72, 168, 176] },
  { id: "skill", label: "skill", w: 0.88, ang: 0.55, rad: 0.7, rgb: [196, 92, 74] },
  { id: "draft", label: "draft", w: 0.92, ang: 1.35, rad: 0.66, rgb: [212, 160, 84] },
  { id: "confirm", label: "confirm", w: 0.86, ang: 2.15, rad: 0.74, rgb: [88, 140, 108] },
  { id: "lesson", label: "lesson", w: 0.7, ang: 2.85, rad: 0.88, rgb: [154, 149, 140] },
  { id: "body", label: "body", w: 0.62, ang: -2.55, rad: 0.92, rgb: [72, 168, 176] },
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

function liveNode(): NodeId | null {
  try {
    const op = loadOperator();
    const open = op.cards.find((c) => c.status === "draft" || c.status === "executing");
    if (open?.status === "executing") return "confirm";
    if (open) return "draft";
    if (op.cards.some((c) => c.status === "rejected")) return "lesson";
    if (liveMemories(op).length) return "memory";
    if (op.activeProjectId) return "body";
  } catch {
    /* SSR / storage */
  }
  return null;
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
      let opMem = 0;
      let opCards = 0;
      try {
        const op = loadOperator();
        opMem = liveMemories(op).length;
        opCards = op.cards.filter((c) => c.status === "draft").length;
      } catch {
        /* ignore */
      }
      const live = liveNode();

      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, R * 1.35);
      g.addColorStop(0, "rgba(212,160,84,0.07)");
      g.addColorStop(0.45, "rgba(72,168,176,0.04)");
      g.addColorStop(1, "rgba(12,12,13,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (Math.random() < 0.06) {
        const i = Math.floor(Math.random() * NODES.length);
        sparks.push({ i, u: 0 });
      }
      if (live) {
        const i = NODES.findIndex((n) => n.id === live);
        if (i >= 0 && Math.random() < 0.12) sparks.push({ i, u: 0 });
      }

      // Operator ring edges in loop order
      const ring = ["talk", "memory", "plan", "skill", "draft", "confirm", "lesson"] as NodeId[];
      for (let i = 0; i < ring.length; i++) {
        const a = NODES.find((n) => n.id === ring[i])!;
        const b = NODES.find((n) => n.id === ring[(i + 1) % ring.length])!;
        const pa = pos(a, cx, cy, R, t);
        const pb = pos(b, cx, cy, R, t);
        ctx.strokeStyle = "rgba(154,149,140,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
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
      ctx.fillText("OPERATOR", cx, cy - 5);
      ctx.fillStyle = "#9a958c";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.fillText("draft → confirm", cx, cy + 11);

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
      ctx.fillText(
        `${opMem} memories · ${opCards} drafts · ${world.hull} hull`,
        14,
        h - 14,
      );

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
        Operator loop
      </p>
    </div>
  );
}
