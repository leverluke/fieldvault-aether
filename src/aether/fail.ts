export type Fail = { reason: string; at: number; action: "hold" | "rtl" | "orbit" };

let last: Fail | null = null;
const KEY = "aether:fail";

export function setFail(reason: string, action: Fail["action"] = "hold") {
  last = { reason, at: Date.now(), action };
  try {
    localStorage.setItem(KEY, JSON.stringify(last));
  } catch {
    /* ignore */
  }
}

export function lastFail() {
  if (last) return last;
  try {
    last = JSON.parse(localStorage.getItem(KEY) || "null") as Fail | null;
  } catch {
    last = null;
  }
  return last;
}

export function failLine() {
  const f = lastFail();
  if (!f) return "No failsafe.";
  return `Failsafe ${f.action}: ${f.reason}.`;
}
