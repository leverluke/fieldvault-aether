export { loadEncoder, encoderReady, routeAgent, routeAgents } from "./encoder";
export { snapshot, describeWorld, recall, remember, brainTrace, type World } from "./world";

import { routeAgents, loadEncoder, encoderReady } from "./encoder";
import { describeWorld, pushTrace, remember, snapshot } from "./world";
import { hushList } from "../hush";
import type { AgentId } from "./bank";

export type Route = {
  agent: AgentId;
  score: number;
  phrase: string;
  world: string;
  agents: { agent: AgentId; score: number; phrase: string }[];
};

export async function bootBrain() {
  await loadEncoder();
}

export async function think(q: string): Promise<Route> {
  const hush = hushList();
  const agents = (await routeAgents(q, 4)).filter((a) => !hush.includes(a.agent));
  const r = agents[0] || { agent: "help" as AgentId, score: 0, phrase: "" };
  const w = snapshot();
  remember({ agent: r.agent });
  pushTrace({ t: Date.now(), q, agent: r.agent, score: r.score });
  return { ...r, world: describeWorld(w), agents };
}

export function brainNote() {
  return encoderReady() ? "Cortex on · 14 subagents" : "Cortex loading…";
}