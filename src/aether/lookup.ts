import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlaceHit = {
  name: string;
  address: string;
  phone?: string;
  hours?: string;
  lat: number;
  lon: number;
  maps: string;
};

const UA = "FieldVault-Aether/1.0 (personal assistant)";

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("lookup failed");
  return res.json();
}

function osmPrefix(t: string) {
  const u = t.toUpperCase();
  if (u === "N" || u === "NODE") return "N";
  if (u === "W" || u === "WAY") return "W";
  return "R";
}

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(
    z.object({
      q: z.string().min(1).max(140),
      lat: z.number().optional(),
      lon: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      q: data.q,
      limit: "6",
    });
    if (data.lat != null && data.lon != null) {
      params.set("lat", String(data.lat));
      params.set("lon", String(data.lon));
    }
    const geo = await getJson(`https://photon.komoot.io/api/?${params.toString()}`);
    const feats = (geo?.features as Array<{
      properties?: Record<string, string | number>;
      geometry?: { coordinates?: number[] };
    }>) ?? [];

    const osmIds: string[] = [];
    const basic: PlaceHit[] = [];
    for (const f of feats) {
      const p = f.properties ?? {};
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const addr = [p.housenumber, p.street, p.city, p.state, p.postcode]
        .filter(Boolean)
        .join(" ");
      basic.push({
        name,
        address: addr || name,
        lat,
        lon,
        maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${addr}`)}`,
      });
      if (p.osm_id && p.osm_type) {
        osmIds.push(`${osmPrefix(String(p.osm_type))}${p.osm_id}`);
      }
    }

    if (osmIds.length) {
      try {
        const extra = await getJson(
          `https://nominatim.openstreetmap.org/lookup?osm_ids=${osmIds.slice(0, 6).join(",")}&format=json&extratags=1`,
        );
        const byName = new Map<string, { phone?: string; hours?: string; display?: string }>();
        for (const row of extra as Array<{
          name?: string;
          display_name?: string;
          extratags?: Record<string, string>;
        }>) {
          const tags = row.extratags ?? {};
          const phone = tags.phone || tags["contact:phone"];
          byName.set((row.name ?? "").toLowerCase(), {
            phone,
            hours: tags.opening_hours,
            display: row.display_name,
          });
        }
        for (const hit of basic) {
          const x = byName.get(hit.name.toLowerCase());
          if (!x) continue;
          hit.phone = x.phone;
          hit.hours = x.hours;
          if (x.display) hit.address = x.display;
        }
      } catch {
        /* phones optional */
      }
    }

    return basic.slice(0, 5);
  });
