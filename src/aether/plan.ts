import { parseSeek } from "@/vision/classes";
import { sendCmd, type Cmd } from "./bus";
import { speak } from "./speech";
import { hullCopy } from "@/vision/hull";

export type PlanStep = {
  kind: "takeoff" | "seek" | "follow" | "hold" | "land" | "cruise" | "eyes";
  target?: string;
};

export type Hunt = "idle" | "seeking" | "approaching" | "locked" | "lost" | "orbit" | "rtl" | "failsafe";

let steps: PlanStep[] = [];
let i = 0;
let holdUntil = 0;
let lastKick = "";
let stepAt = 0;

const SEEK_MS = 9000;
const LOST_MS = 5000;

export function parsePlan(q: string): PlanStep[] | null {
  const parts = q
    .split(/\s*(?:,| then | and then |;\s*|\band (?:then )?(?=take|find|hold|land|go|look|search|start|follow|cast|roll|dock|park|launch))\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  if (parts.length < 2) return null;
  const out: PlanStep[] = [];
  for (const p of parts) {
    const step = one(p);
    if (step) out.push(step);
  }
  return out.length >= 2 ? out : null;
}

function one(p: string): PlanStep | null {
  if (/\b(take\s*off|launch|cast off|roll out|deploy)\b/.test(p)) return { kind: "takeoff" };
  if (/\b(land|dock|park|recover)\b/.test(p)) return { kind: "land" };
  if (/\bhold\b/.test(p)) return { kind: "hold" };
  if (/\b(hold heading|keep heading|hold course)\b/.test(p)) return { kind: "cruise" };
  if (/\b(start (the )?camera|open (your )?eyes|eyes on)\b/.test(p)) return { kind: "eyes" };
  const fol = p.match(/\bfollow\s+#?(\d+)\b/i);
  if (fol) return { kind: "follow", target: fol[1] };
  if (/\bfollow\b/.test(p)) return { kind: "follow", target: "that" };
  const seek = parseSeek(p);
  if (seek && /\b(find|look|search|go to|point|get the|where)\b/.test(p)) return { kind: "seek", target: seek };
  return null;
}

export function startPlan(next: PlanStep[]) {
  steps = next;
  i = 0;
  holdUntil = 0;
  lastKick = "";
  stepAt = Date.now();
}

export function clearPlan() {
  steps = [];
  i = 0;
  lastKick = "";
  stepAt = 0;
}

export function currentPlan() {
  return { steps, i, current: steps[i] as PlanStep | undefined };
}

export function describePlan() {
  if (!steps.length) return "";
  return steps
    .map((s, n) => {
      const copy = hullCopy();
      const label =
        s.kind === "seek"
          ? `find ${s.target}`
          : s.kind === "follow"
            ? `follow #${s.target}`
            : s.kind === "takeoff"
              ? copy.go.toLowerCase()
              : s.kind === "land"
                ? copy.stop.toLowerCase()
                : s.kind;
      return n === i ? `[${label}]` : label;
    })
    .join(" → ");
}

export function kickStep(): Cmd | null {
  const s = steps[i];
  if (!s) return null;
  const key = `${i}:${s.kind}:${s.target || ""}`;
  if (key === lastKick) return null;
  lastKick = key;
  stepAt = Date.now();
  if (s.kind === "takeoff") return { type: "craft-takeoff" };
  if (s.kind === "land") return { type: "craft-land" };
  if (s.kind === "hold") {
    holdUntil = Date.now() + 1400;
    return { type: "craft-hold" };
  }
  if (s.kind === "cruise") return { type: "craft-auto" };
  if (s.kind === "eyes") return { type: "see-start" };
  if (s.kind === "seek" && s.target) return { type: "see-seek", body: s.target };
  if (s.kind === "follow" && s.target) return { type: "see-follow", body: s.target };
  return null;
}

export function advancePlan(reason: "airborne" | "lock" | "held" | "ground" | "skip") {
  const s = steps[i];
  if (!s) return false;
  if (reason === "airborne" && s.kind !== "takeoff") return false;
  if (reason === "lock" && s.kind !== "seek" && s.kind !== "follow") return false;
  if (reason === "held" && s.kind !== "hold") return false;
  if (reason === "ground" && s.kind !== "land") return false;
  i += 1;
  lastKick = "";
  stepAt = Date.now();
  if (i >= steps.length) {
    steps = [];
    i = 0;
    return true;
  }
  return true;
}

export function skipPlan(note?: string) {
  const s = steps[i];
  if (!s) return false;
  if (note || s.kind === "seek") {
    speak(s.kind === "seek" || s.kind === "follow" ? `No ${s.target}. Moving on.` : "Moving on.", false);
  }
  return advancePlan("skip");
}

export function syncPlan(craft: { mode: string; alt: number }, hunt: Hunt) {
  const s = steps[i];
  if (!s) return;
  const waited = stepAt ? Date.now() - stepAt : 0;
  if (s.kind === "takeoff" && (craft.mode === "cruise" || craft.mode === "hold") && (craft.alt >= 10 || !hullCopy().usesAlt)) {
    advancePlan("airborne");
  } else if ((s.kind === "seek" || s.kind === "follow") && hunt === "locked") {
    advancePlan("lock");
  } else if ((s.kind === "seek" || s.kind === "follow") && hunt === "lost" && waited > LOST_MS) {
    skipPlan();
  } else if ((s.kind === "seek" || s.kind === "follow") && waited > SEEK_MS) {
    skipPlan();
  } else if (s.kind === "hold" && holdUntil && Date.now() >= holdUntil) {
    advancePlan("held");
  } else if (s.kind === "land" && craft.mode === "pad") {
    advancePlan("ground");
  } else if (s.kind === "takeoff" && waited > 12000) {
    skipPlan();
  }
  const cmd = kickStep();
  if (cmd) sendCmd(cmd);
}
