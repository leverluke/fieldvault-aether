import { quietHours } from "./log";
import { loadLastPlace } from "./memory";

export function closedNow(hours?: string) {
  const h = new Date().getHours();
  if (quietHours()) return "quiet hours";
  if (h < 7 || h >= 22) return "late";
  const src = hours || loadLastPlace()?.hours || "";
  const m = src.match(/(\d{1,2})\s*(a\.?m\.?)?.*?(\d{1,2})\s*(p\.?m\.?|a\.?m\.?)?/i);
  if (!m) return null;
  let open = Number(m[1]);
  let close = Number(m[3]);
  if ((m[4] || "").toLowerCase().startsWith("p") && close < 12) close += 12;
  if (h < open || h >= close) return `hours ${src}`;
  return null;
}
