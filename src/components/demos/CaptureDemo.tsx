"use client";

import { useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOTS = [
  { id: "overall", label: "Whole pump from a few steps back", w: 28 },
  { id: "tag", label: "Nameplate or painted tag", w: 28 },
  { id: "coupling", label: "Coupling / motor connection", w: 10 },
  { id: "seal", label: "Seal area", w: 10 },
  { id: "suction", label: "Suction pipe and valve", w: 8 },
  { id: "discharge", label: "Discharge pipe and valve", w: 8 },
  { id: "base", label: "Baseplate and bolts", w: 5 },
  { id: "other", label: "Anything else useful", w: 3 },
];

function scoreFor(taken: Set<string>) {
  const total = SHOTS.reduce((s, x) => s + x.w, 0);
  const got = SHOTS.filter((s) => taken.has(s.id)).reduce((s, x) => s + x.w, 0);
  return Math.round((got / total) * 100);
}

export function CaptureDemo() {
  const [taken, setTaken] = useState<Set<string>>(() => new Set());
  const score = useMemo(() => scoreFor(taken), [taken]);
  const next = SHOTS.find((s) => !taken.has(s.id));

  function toggle(id: string) {
    setTaken((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Live demo · P-101 charge pump
          </p>
          <h3 className="mt-1 font-display text-2xl text-fg">Guided capture</h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl tabular-nums text-fg">{score}%</p>
          <p className="text-xs text-muted">
            {score >= 80 ? "Ready to leave" : "Stay on the unit"}
          </p>
        </div>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${score}%` }}
        />
      </div>
      {next ? (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated px-4 py-3">
          <p className="text-sm text-fg">
            <span className="text-muted">Next shot · </span>
            {next.label}
          </p>
          <Button size="sm" onClick={() => toggle(next.id)}>
            <Camera size={14} />
            Take
          </Button>
        </div>
      ) : (
        <p className="mb-5 rounded-lg border border-border bg-elevated px-4 py-3 text-sm text-fg">
          Sequence complete.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {SHOTS.map((s) => {
          const on = taken.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex w-full min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150",
                  on
                    ? "border-primary/40 bg-elevated text-fg"
                    : "border-border text-muted hover:text-fg",
                )}
              >
                <span>{s.label}</span>
                <span className="font-mono text-xs tabular-nums">
                  {on ? "In" : "—"} · {s.w}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setTaken(new Set())}>
          Reset demo
        </Button>
      </div>
    </div>
  );
}
