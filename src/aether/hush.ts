import type { AgentId } from "./brain/bank";

const KEY = "aether:hush";

export function hushList(): AgentId[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as AgentId[];
  } catch {
    return [];
  }
}

export function hushAgent(id: AgentId, on: boolean) {
  const s = new Set(hushList());
  if (on) s.add(id);
  else s.delete(id);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function isHushed(id: AgentId) {
  return hushList().includes(id);
}
