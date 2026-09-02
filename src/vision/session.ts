import type { Frame } from "./detector";

export type ClipFrame = {
  t: number;
  seek?: string;
  seekId?: number;
  img?: string;
  objects: {
    id?: number;
    class: string;
    name?: string;
    color?: string;
    score: number;
    x: number;
    y: number;
    w: number;
    h: number;
    pinned?: boolean;
    layer?: string;
    bearing?: string;
    range?: string;
  }[];
  path?: number;
};

let on = false;
let started = 0;
let clips: ClipFrame[] = [];
let lastStill = 0;
const stills: HTMLCanvasElement | null = typeof document !== "undefined" ? document.createElement("canvas") : null;

export function isRecording() {
  return on;
}

let geo: { lat: number; lon: number; acc?: number } | null = null;

export function startSession() {
  on = true;
  started = Date.now();
  clips = [];
  lastStill = 0;
  geo = null;
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        geo = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      },
      () => undefined,
      { timeout: 4000, maximumAge: 60000 },
    );
  }
}

export function stopSession() {
  on = false;
}

export function clearSession() {
  on = false;
  clips = [];
  started = 0;
}

function stillOf(src: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement): string | undefined {
  if (!stills) return undefined;
  const w =
    "videoWidth" in src && src.videoWidth
      ? src.videoWidth
      : "naturalWidth" in src && src.naturalWidth
        ? src.naturalWidth
        : src.width;
  const h =
    "videoHeight" in src && src.videoHeight
      ? src.videoHeight
      : "naturalHeight" in src && src.naturalHeight
        ? src.naturalHeight
        : src.height;
  if (!w || !h) return undefined;
  const max = 320;
  const scale = Math.min(1, max / Math.max(w, h));
  stills.width = Math.max(8, Math.round(w * scale));
  stills.height = Math.max(8, Math.round(h * scale));
  const ctx = stills.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(src, 0, 0, stills.width, stills.height);
  try {
    return stills.toDataURL("image/jpeg", 0.55);
  } catch {
    return undefined;
  }
}

export function pushFrame(
  frame: Frame,
  src?: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null,
) {
  if (!on) return;
  if (clips.length && frame.t - clips[clips.length - 1].t < 200) return;
  const takeStill = Boolean(src) && frame.t - lastStill > 700;
  if (takeStill) lastStill = frame.t;
  clips.push({
    t: frame.t,
    seek: frame.seek,
    seekId: frame.seekId,
    img: takeStill && src ? stillOf(src) : undefined,
    path: frame.occupancy?.path.length,
    objects: frame.objects.map((o) => ({
      id: o.id,
      class: o.class,
      name: o.name,
      color: o.color,
      score: Number(o.score.toFixed(3)),
      x: Number(o.x.toFixed(3)),
      y: Number(o.y.toFixed(3)),
      w: Number(o.w.toFixed(3)),
      h: Number(o.h.toFixed(3)),
      pinned: o.pinned,
      layer: o.layer,
      bearing: o.bearing,
      range: o.range,
    })),
  });
  if (clips.length > 240) clips.shift();
}

export function sessionCount() {
  return clips.length;
}

export function sessionStills() {
  return clips.filter((c) => c.img).length;
}

export function sessionClips() {
  return clips;
}

export function sessionJson() {
  return JSON.stringify(
    {
      started,
      geo,
      ended: Date.now(),
      frames: clips.length,
      stills: sessionStills(),
      clips,
    },
    null,
    2,
  );
}
