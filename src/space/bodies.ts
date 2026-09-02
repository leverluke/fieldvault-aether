export const AU_KM = 149_597_870.7;
export const C_KM_S = 299_792.458;

export type Body = {
  id: string;
  name: string;
  au: number;
  radiusKm: number;
  fill: string;
  kind: "star" | "planet" | "dwarf" | "edge" | "probe";
  note: string;
};

export const BODIES: Body[] = [
  {
    id: "sun",
    name: "Sun",
    au: 0,
    radiusKm: 696_340,
    fill: "#e8dcc0",
    kind: "star",
    note: "Everything else is a rounding error.",
  },
  {
    id: "mercury",
    name: "Mercury",
    au: 0.387,
    radiusKm: 2_440,
    fill: "#9a9088",
    kind: "planet",
    note: "Light from here is about 3 minutes old.",
  },
  {
    id: "venus",
    name: "Venus",
    au: 0.723,
    radiusKm: 6_052,
    fill: "#c4b49a",
    kind: "planet",
    note: "Almost Earth’s size. Not almost Earth’s weather.",
  },
  {
    id: "earth",
    name: "Earth",
    au: 1,
    radiusKm: 6_371,
    fill: "#8aa0b0",
    kind: "planet",
    note: "Lima, Ohio is on this one. You cannot see it.",
  },
  {
    id: "mars",
    name: "Mars",
    au: 1.524,
    radiusKm: 3_390,
    fill: "#b08978",
    kind: "planet",
    note: "Radio to Earth: about 4 to 24 minutes, one way.",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    au: 5.204,
    radiusKm: 69_911,
    fill: "#c2b19a",
    kind: "planet",
    note: "The first time the emptiness really shows.",
  },
  {
    id: "saturn",
    name: "Saturn",
    au: 9.583,
    radiusKm: 58_232,
    fill: "#d2c4a6",
    kind: "planet",
    note: "Rings are wide. The gap from Jupiter is wider.",
  },
  {
    id: "uranus",
    name: "Uranus",
    au: 19.191,
    radiusKm: 25_362,
    fill: "#9bb0b8",
    kind: "planet",
    note: "Discovered with math, then a telescope.",
  },
  {
    id: "neptune",
    name: "Neptune",
    au: 30.07,
    radiusKm: 24_622,
    fill: "#6f86a8",
    kind: "planet",
    note: "Sunlight here is a dim afternoon.",
  },
  {
    id: "pluto",
    name: "Pluto",
    au: 39.48,
    radiusKm: 1_188,
    fill: "#b8a898",
    kind: "dwarf",
    note: "A pebble in a very large dark.",
  },
  {
    id: "pbd",
    name: "Pale Blue Dot",
    au: 40.5,
    radiusKm: 1,
    fill: "#c5cdd8",
    kind: "edge",
    note: "Voyager 1 turned around here, 14 Feb 1990.",
  },
  {
    id: "heliopause",
    name: "Heliopause",
    au: 120,
    radiusKm: 1,
    fill: "#8b909a",
    kind: "edge",
    note: "The Sun’s wind gives up. Interstellar space begins.",
  },
  {
    id: "voyager1",
    name: "Voyager 1",
    au: 166,
    radiusKm: 0.002,
    fill: "#c5cdd8",
    kind: "probe",
    note: "Still talking. The reply takes about two days.",
  },
];

export const SPEEDS = [
  { id: "walk", label: "Walk", kmPerS: 0.00139 },
  { id: "car", label: "Highway", kmPerS: 0.033 },
  { id: "jet", label: "Airliner", kmPerS: 0.25 },
  { id: "iss", label: "ISS", kmPerS: 7.66 },
  { id: "voyager", label: "Voyager", kmPerS: 17 },
  { id: "light", label: "Light", kmPerS: C_KM_S },
] as const;

export const WARPS = [
  { id: "1", label: "1×", n: 1 },
  { id: "3", label: "10³×", n: 1e3 },
  { id: "6", label: "10⁶×", n: 1e6 },
  { id: "9", label: "10⁹×", n: 1e9 },
] as const;

export function kmOf(au: number) {
  return au * AU_KM;
}

export function auOf(km: number) {
  return km / AU_KM;
}

export function lightSeconds(km: number) {
  return Math.abs(km) / C_KM_S;
}

export function formatDuration(seconds: number) {
  const s = Math.abs(seconds);
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  if (s < 90) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  if (s < 3600 * 2) return `${(s / 60).toFixed(s < 600 ? 1 : 0)} min`;
  if (s < 86400 * 2) return `${(s / 3600).toFixed(1)} h`;
  if (s < 86400 * 400) return `${(s / 86400).toFixed(s < 86400 * 10 ? 1 : 0)} d`;
  if (s < 86400 * 365.25 * 20) return `${(s / (86400 * 365.25)).toFixed(1)} yr`;
  return `${(s / (86400 * 365.25)).toExponential(1)} yr`;
}

export function formatKm(km: number) {
  const a = Math.abs(km);
  if (a < 1) return `${(km * 1000).toFixed(0)} m`;
  if (a < 1e6) return `${km.toFixed(0)} km`;
  if (a < AU_KM * 0.05) return `${(km / 1e6).toFixed(2)} million km`;
  return `${(km / AU_KM).toFixed(km / AU_KM < 10 ? 3 : 2)} AU`;
}
