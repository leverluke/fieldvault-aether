import { setFact } from "./brain/facts";
import { addWaypoint } from "@/vision/waypoints";

export function importFieldVault(raw: unknown) {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw as Record<string, unknown>] : [];
  let n = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const name = String(r.name || r.tag || r.equipment || r.title || "");
    const note = String(r.area || r.notes || r.tag || "");
    if (name) {
      setFact(name, note || "FieldVault");
      n++;
    }
    const lat = Number(r.lat || r.latitude);
    const lon = Number(r.lon || r.lng || r.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      addWaypoint(name || "fv", lon * 0.002, lat * 0.002, "wp");
    }
  }
  return n;
}
