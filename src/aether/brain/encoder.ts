import type { UniversalSentenceEncoder } from "@tensorflow-models/universal-sentence-encoder";
import { BANK, type AgentId } from "./bank";

const DIM = 256;
let use: UniversalSentenceEncoder | null = null;
let ready = false;
const cache = new Map<string, Float32Array>();

function hashGrams(text: string) {
  const v = new Float32Array(DIM);
  const s = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, " ")} `;
  for (let i = 0; i < s.length - 2; i++) {
    const g = s.slice(i, i + 3);
    let h = 2166136261;
    for (let j = 0; j < g.length; j++) h = Math.imul(h ^ g.charCodeAt(j), 16777619);
    const i0 = (h >>> 0) % DIM;
    v[i0] += 1;
  }
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

export function encoderReady() {
  return ready;
}

export function loadEncoder() {
  if (ready && use) return Promise.resolve();
  return (async () => {
    try {
      const mod = await import("@tensorflow-models/universal-sentence-encoder");
      use = await mod.load();
      ready = true;
    } catch {
      use = null;
      ready = true;
    }
  })();
}

export async function embed(text: string): Promise<Float32Array> {
  const key = text.toLowerCase().trim();
  const hit = cache.get(key);
  if (hit) return hit;
  if (use) {
    try {
      const t = await use.embed([key]);
      const arr = (await t.array()) as number[][];
      t.dispose();
      const v = Float32Array.from(arr[0] || []);
      cache.set(key, v);
      return v;
    } catch {
      /* fall through */
    }
  }
  const v = hashGrams(key);
  cache.set(key, v);
  return v;
}

function cosine(a: Float32Array, b: Float32Array) {
  const n = Math.min(a.length, b.length);
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den ? d / den : 0;
}

type Proto = { agent: AgentId; vec: Float32Array; phrase: string };
let protos: Proto[] = [];

export async function indexBank() {
  await loadEncoder();
  const rows: Proto[] = [];
  for (const b of BANK) {
    for (const p of b.phrases) {
      rows.push({ agent: b.agent, vec: await embed(p), phrase: p });
    }
  }
  protos = rows;
}

export async function routeAgents(q: string, k = 3): Promise<{ agent: AgentId; score: number; phrase: string }[]> {
  if (!protos.length) await indexBank();
  const v = await embed(q);
  const best = new Map<AgentId, { score: number; phrase: string }>();
  for (const p of protos) {
    const s = cosine(v, p.vec);
    const prev = best.get(p.agent);
    if (!prev || s > prev.score) best.set(p.agent, { score: s, phrase: p.phrase });
  }
  const ranked = [...best.entries()]
    .map(([agent, r]) => ({ agent, score: r.score, phrase: r.phrase }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  return ranked.filter((r, i) => i === 0 || (r.score >= top - 0.12 && r.score >= 0.4)).slice(0, k);
}

export async function routeAgent(q: string): Promise<{ agent: AgentId; score: number; phrase: string }> {
  const rows = await routeAgents(q, 1);
  return rows[0] || { agent: "help", score: 0, phrase: "" };
}
