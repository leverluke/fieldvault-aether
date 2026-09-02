"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Pt = { x: number; y: number; acc: number };

function cluster(points: Pt[], r = 14) {
  const used = new Set<number>();
  const groups: Pt[][] = [];
  points.forEach((p, i) => {
    if (used.has(i)) return;
    const g = [p];
    used.add(i);
    points.forEach((q, j) => {
      if (used.has(j)) return;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < r) {
        g.push(q);
        used.add(j);
      }
    });
    groups.push(g);
  });
  return groups;
}

export function GpsDemo() {
  const [points, setPoints] = useState<Pt[]>([
    { x: 28, y: 42, acc: 8 },
    { x: 34, y: 48, acc: 12 },
    { x: 72, y: 30, acc: 9 },
  ]);
  const [status, setStatus] = useState("Last fix ±8 m");
  const groups = cluster(points);

  function capture() {
    const last = points[points.length - 1];
    const nx = Math.min(92, Math.max(8, last.x + (Math.random() * 18 - 6)));
    const ny = Math.min(88, Math.max(12, last.y + (Math.random() * 16 - 7)));
    const acc = Math.round(6 + Math.random() * 14);
    setPoints((p) => [...p, { x: nx, y: ny, acc }]);
    setStatus(`Location ±${acc} m · just now`);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Live demo · plant GPS
          </p>
          <h3 className="mt-1 font-display text-2xl text-fg">FixPlot</h3>
        </div>
        <p className="font-mono text-xs text-muted">{status}</p>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-elevated">
        <svg viewBox="0 0 100 62" className="h-full w-full" aria-hidden>
          {[20, 40, 60, 80].map((x) => (
            <line
              key={x}
              x1={x}
              y1="0"
              x2={x}
              y2="62"
              stroke="currentColor"
              className="text-border"
              strokeWidth="0.3"
            />
          ))}
          {groups.map((g, i) => {
            const cx = g.reduce((s, p) => s + p.x, 0) / g.length;
            const cy = g.reduce((s, p) => s + p.y, 0) / g.length;
            return (
              <circle
                key={`c${i}`}
                cx={cx}
                cy={cy}
                r={10}
                fill="none"
                stroke="currentColor"
                className="text-primary/40"
                strokeWidth="0.5"
              />
            );
          })}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.acc / 6}
                fill="currentColor"
                className="text-primary/15"
              />
              <circle cx={p.x} cy={p.y} r={1.4} fill="currentColor" className="text-primary" />
            </g>
          ))}
        </svg>
        <p className="pointer-events-none absolute left-3 top-3 text-xs uppercase tracking-wider text-muted">
          {groups.length} areas · {points.length} tags
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Nearby points become a suggested area.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPoints([{ x: 28, y: 42, acc: 8 }])}>
            Clear
          </Button>
          <Button size="sm" onClick={capture}>
            Capture GPS
          </Button>
        </div>
      </div>
    </div>
  );
}
