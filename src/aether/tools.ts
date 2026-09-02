const WMO: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "rime fog",
  51: "light drizzle",
  61: "rain",
  63: "rain",
  71: "snow",
  80: "showers",
  95: "thunderstorms",
};

async function getJson(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) throw new Error("busy");
    if (!res.ok) throw new Error("fetch failed");
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function geocode(name: string) {
  const q = encodeURIComponent(name);
  const data = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`,
  );
  const hit = data?.results?.[0];
  if (!hit) return null;
  return {
    name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    lat: hit.latitude as number,
    lon: hit.longitude as number,
    tz: (hit.timezone as string) || "auto",
  };
}

export async function weather(place: string) {
  const loc = await geocode(place);
  if (!loc) return { line: `I could not find ${place}.`, loc: null };
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(loc.lat));
  u.searchParams.set("longitude", String(loc.lon));
  u.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  u.searchParams.set("daily", "sunrise,sunset,temperature_2m_max,temperature_2m_min");
  u.searchParams.set("timezone", loc.tz);
  u.searchParams.set("temperature_unit", "fahrenheit");
  u.searchParams.set("wind_speed_unit", "mph");
  const data = await getJson(u.toString());
  const cur = data.current;
  const daily = data.daily;
  const sky = WMO[cur.weather_code as number] ?? "mixed skies";
  const rise = String(daily.sunrise[0]).slice(11, 16);
  const set = String(daily.sunset[0]).slice(11, 16);
  return {
    line: `${loc.name}: ${Math.round(cur.temperature_2m)}°F, ${sky}, wind ${Math.round(cur.wind_speed_10m)} mph. High ${Math.round(daily.temperature_2m_max[0])}°, low ${Math.round(daily.temperature_2m_min[0])}°. Sunrise ${rise}, sunset ${set}.`,
    loc,
  };
}

export async function issNow() {
  const data = await getJson("https://api.wheretheiss.at/v1/satellites/25544");
  const lat = data.latitude as number;
  const lon = data.longitude as number;
  const alt = Math.round(data.altitude as number);
  const vel = Math.round(data.velocity as number);
  let where = `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
  try {
    const geo = await getJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const place = [geo.principalSubdivision, geo.countryName].filter(Boolean).join(", ");
    const ocean = geo.localityInfo?.informative?.find?.((x: { name?: string }) =>
      /ocean|sea/i.test(x.name ?? ""),
    )?.name;
    where = place || ocean || geo.city || where;
  } catch {
    /* keep coords */
  }
  return `The ISS is over ${where}, ${alt} km up, ${vel} km/h.`;
}

export async function wiki(topic: string) {
  const q = encodeURIComponent(topic);
  const search = await getJson(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=1&namespace=0&format=json&origin=*`,
  );
  const title = search?.[1]?.[0] as string | undefined;
  if (!title) return `Nothing useful on Wikipedia for “${topic}”.`;
  const sum = await getJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  );
  const extract = (sum.extract as string) || "";
  const clip = extract.split(". ").slice(0, 2).join(". ");
  return clip.endsWith(".") ? clip : `${clip}.`;
}

export async function define(word: string) {
  const data = await getJson(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  const meaning = data?.[0]?.meanings?.[0];
  const def = meaning?.definitions?.[0]?.definition as string | undefined;
  if (!def) return `No definition for “${word}”.`;
  const pos = meaning.partOfSpeech as string;
  return `${word} (${pos}): ${def}`;
}

export function clock(tz?: string) {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return now.toLocaleString("en-US", tz ? { ...opts, timeZone: tz } : opts);
  } catch {
    return now.toLocaleString("en-US", opts);
  }
}

const CITY_TZ: Record<string, string> = {
  lima: "America/New_York",
  ohio: "America/New_York",
  "new york": "America/New_York",
  chicago: "America/Chicago",
  denver: "America/Denver",
  "los angeles": "America/Los_Angeles",
  london: "Europe/London",
  paris: "Europe/Paris",
  tokyo: "Asia/Tokyo",
  sydney: "Australia/Sydney",
  dubai: "Asia/Dubai",
  utc: "UTC",
};

export async function timeAt(place: string) {
  const loc = await geocode(place);
  if (!loc) return `I could not find ${place}.`;
  return `In ${loc.name} it is ${clock(loc.tz === "auto" ? undefined : loc.tz)}.`;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export async function distanceBetween(from: string, to: string) {
  const a = await geocode(from);
  const b = await geocode(to);
  if (!a || !b) return { line: `I could not place ${!a ? from : to}.`, km: null as number | null };
  const km = haversineKm(a, b);
  const miles = km * 0.621371;
  const line = `${a.name} to ${b.name}: ${miles.toFixed(0)} miles (${km.toFixed(0)} km). Straight line, not traffic.`;
  return { line, km, from: a, to: b };
}

const UNIT: Record<string, { dim: string; to: number }> = {
  mile: { dim: "len", to: 1609.34 },
  miles: { dim: "len", to: 1609.34 },
  km: { dim: "len", to: 1000 },
  kilometer: { dim: "len", to: 1000 },
  kilometers: { dim: "len", to: 1000 },
  meter: { dim: "len", to: 1 },
  meters: { dim: "len", to: 1 },
  m: { dim: "len", to: 1 },
  foot: { dim: "len", to: 0.3048 },
  feet: { dim: "len", to: 0.3048 },
  ft: { dim: "len", to: 0.3048 },
  inch: { dim: "len", to: 0.0254 },
  inches: { dim: "len", to: 0.0254 },
  lb: { dim: "mass", to: 0.453592 },
  lbs: { dim: "mass", to: 0.453592 },
  pound: { dim: "mass", to: 0.453592 },
  pounds: { dim: "mass", to: 0.453592 },
  kg: { dim: "mass", to: 1 },
  kilo: { dim: "mass", to: 1 },
  kilos: { dim: "mass", to: 1 },
  psi: { dim: "p", to: 6894.76 },
  bar: { dim: "p", to: 100000 },
  gallon: { dim: "vol", to: 3.78541 },
  gallons: { dim: "vol", to: 3.78541 },
  liter: { dim: "vol", to: 1 },
  liters: { dim: "vol", to: 1 },
  litre: { dim: "vol", to: 1 },
  litres: { dim: "vol", to: 1 },
};

export function convertUnits(amount: number, from: string, to: string): string | null {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  if ((f === "c" || f === "celsius") && (t === "f" || t === "fahrenheit")) {
    return `${amount}°C is ${Math.round(amount * 9 / 5 + 32)}°F.`;
  }
  if ((f === "f" || f === "fahrenheit") && (t === "c" || t === "celsius")) {
    return `${amount}°F is ${Math.round(((amount - 32) * 5) / 9)}°C.`;
  }
  const A = UNIT[f];
  const B = UNIT[t];
  if (!A || !B || A.dim !== B.dim) return null;
  const n = (amount * A.to) / B.to;
  const shown = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return `${amount} ${from} is ${shown} ${to}.`;
}

export async function convertMoney(amount: number, from: string, to: string) {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  const data = await getJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(f)}`);
  const rate = data?.rates?.[t];
  if (typeof rate !== "number") return `I could not convert ${f} to ${t}.`;
  return `${amount} ${f} is ${(amount * rate).toFixed(2)} ${t}.`;
}

export function calc(expr: string) {
  const clean = expr.replace(/[^0-9+\-*/().%\s]/g, "");
  if (!clean.trim() || !/^[\d\s+\-*/().%]+$/.test(clean)) return null;
  try {
    const n = Function(`"use strict"; return (${clean})`)() as number;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    return n;
  } catch {
    return null;
  }
}

export function parseDuration(text: string): number | null {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i,
  );
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith("h")) return n * 3600;
  if (u.startsWith("m")) return n * 60;
  return n;
}

export async function here(): Promise<string> {
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("no geo"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
    });
  });
  const { latitude, longitude, accuracy } = pos.coords;
  try {
    const geo = await getJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    const place = [geo.city, geo.principalSubdivision, geo.countryName]
      .filter(Boolean)
      .join(", ");
    return `${place || "Your fix"} · ${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ±${Math.round(accuracy)} m.`;
  } catch {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ±${Math.round(accuracy)} m.`;
  }
}
