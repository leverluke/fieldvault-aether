import { describePose } from "@/vision/slam";
import { getLastFrame } from "../bus";
import { snapshot } from "./world";
import { getFact, listFacts } from "./facts";
import type { Reply } from "../types";

export function worldQa(q: string): Reply | null {
  const frame = getLastFrame();
  const w = snapshot();

  if (/\b(path|way) (clear|blocked|ok)\b/.test(q) || /\bis (the )?path\b/.test(q)) {
    if (!frame) return { text: "No frame yet. Open eyes.", ran: "eyes" };
    return { text: frame.block ? "Path blocked." : "Path clear.", speak: frame.block ? "Blocked." : "Clear.", ran: "eyes" };
  }

  if (/\bhow many\b/.test(q)) {
    const n = w.objects.length;
    const cls = q.replace(/.*how many\s+/, "").replace(/s\b/, "").trim();
    const c = cls
      ? (frame?.objects || []).filter((o) => o.class === cls || (o.name || "").includes(cls)).length
      : n;
    const text = `${c}${cls ? ` ${cls}` : " labeled"}.`;
    return { text, speak: text, ran: "eyes" };
  }

  if (/\b(where am i|heading|how far)\b/.test(q)) {
    const text = describePose();
    return { text, speak: text, ran: "eyes" };
  }

  if (/\b(what is that|what's that|who is that|what's this)\b/.test(q)) {
    const o = frame?.objects.find((x) => x.layer !== "bg") || frame?.objects[0];
    if (!o) return { text: "Nothing in frame.", ran: "eyes" };
    const text = `#${o.id ?? "?"} ${o.name || o.class} ${o.bearing || ""} ${o.range || ""} Q${Math.round((o.quality ?? o.score) * 100)}.`;
    return { text, speak: text, ran: "eyes" };
  }

  if (/\bwhat do you know about\b/.test(q) || /\bwhat is the\b/.test(q) || /\bwhat's the\b/.test(q)) {
    const fact = getFact(q.replace(/what (do you know about|is the|is|'s the)\s+/, ""));
    if (fact) return { text: `${fact.k}: ${fact.v}`, ran: "memory" };
  }

  if (/\b(facts|what do you remember)\b/.test(q)) {
    const rows = listFacts();
    if (!rows.length) return { text: "No facts stored. Say “remember the gate code is 4455”.", ran: "memory" };
    return { text: rows.map((f) => `${f.k}: ${f.v}`).join("\n"), ran: "memory" };
  }

  return null;
}
