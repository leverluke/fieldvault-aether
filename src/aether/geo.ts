const KEY = "aether:fence";

export type Fence = { name: string; lat: number; lon: number; m: number; routine?: string };

function load(): Fence[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Fence[];
  } catch {
    return [];
  }
}

function save(rows: Fence[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function addFence(name: string, lat: number, lon: number, m = 80, routine?: string) {
  const rows = load().filter((f) => f.name !== name);
  rows.push({ name, lat, lon, m, routine });
  save(rows);
}

export function fences() {
  return load();
}

function distM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function watchFences(onEnter: (f: Fence) => void) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => undefined;
  const inside = new Set<string>();
  const id = navigator.geolocation.watchPosition(
    (p) => {
      const here = { lat: p.coords.latitude, lon: p.coords.longitude };
      for (const f of load()) {
        const d = distM(here, f);
        if (d <= f.m && !inside.has(f.name)) {
          inside.add(f.name);
          onEnter(f);
        }
        if (d > f.m * 1.2) inside.delete(f.name);
      }
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 8000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
