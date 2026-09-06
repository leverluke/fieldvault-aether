const TILE_CACHE = "fv-tiles-v1";
const TILE_HOSTS = ["server.arcgisonline.com", "tile.openstreetmap.org"];

export function isTileUrl(url: string) {
  try {
    const u = new URL(url, "https://local");
    return TILE_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

function tileXY(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latR = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  return { x, y };
}

export function tileUrlsAround(lat: number, lng: number, zooms = [16, 17, 18], pad = 2) {
  const urls: string[] = [];
  for (const z of zooms) {
    const { x, y } = tileXY(lat, lng, z);
    for (let dx = -pad; dx <= pad; dx++) {
      for (let dy = -pad; dy <= pad; dy++) {
        urls.push(
          `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y + dy}/${x + dx}`,
        );
      }
    }
  }
  return urls;
}

export async function prefetchWalkTiles(lat: number, lng: number) {
  if (typeof caches === "undefined") return 0;
  const cache = await caches.open(TILE_CACHE);
  const urls = tileUrlsAround(lat, lng);
  let n = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await cache.match(url)) {
          n++;
          return;
        }
        const res = await fetch(url, { mode: "cors" });
        if (res.ok) {
          await cache.put(url, res);
          n++;
        }
      } catch {
        /* offline or blocked */
      }
    }),
  );
  return n;
}

export async function matchCachedTile(req: Request) {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(TILE_CACHE);
  return cache.match(req);
}
