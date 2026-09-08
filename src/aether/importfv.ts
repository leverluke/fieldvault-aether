import { setFact } from "./brain/facts";
import { addWaypoint } from "@/vision/waypoints";
import { writeRowsToFieldVault } from "@/fieldvault/bridge";
import { mapImportRow } from "@/fieldvault/format.js";

function sketchFromGps(lat: number, lon: number) {
  // Keep a local sketch offset without crushing real GPS. Aether canvas is ~[-2, 2].
  return { wx: ((lon + 95) % 2) - 1, wy: ((lat - 29) % 2) - 1 };
}

export async function importFieldVault(raw: unknown) {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw as Record<string, unknown>] : [];
  let n = 0;
  try {
    n = await writeRowsToFieldVault(rows);
  } catch {
    n = 0;
  }
  for (const row of rows) {
    const mapped = mapImportRow(row);
    if (!mapped.tag) continue;
    if (!n) n += 1;
    setFact(mapped.tag, mapped.notes || "FieldVault");
    if (mapped.lat != null && mapped.lng != null) {
      const { wx, wy } = sketchFromGps(mapped.lat, mapped.lng);
      addWaypoint(mapped.tag, wx, wy, "wp");
    }
  }
  return n;
}
