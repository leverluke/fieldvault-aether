import { sessionJson, sessionClips } from "./session";
import { roomList } from "./room";
import { floorplanPng, getPose, slamGrid } from "./slam";
import { listWaypoints, metersPerUnit } from "./waypoints";
import { taughtList } from "./teach";
import { listFacts } from "@/aether/brain/facts";

function download(name: string, body: string | Blob, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(typeof body === "string" ? new Blob([body], { type }) : body);
  a.download = name;
  a.click();
}

function interpolate() {
  const clips = sessionClips();
  const ids = new Set<number>();
  for (const c of clips) for (const o of c.objects) if (o.id != null) ids.add(o.id);
  const extra: typeof clips = clips.map((c) => ({ ...c, objects: c.objects.slice() }));
  for (const id of ids) {
    const hits: { i: number; o: (typeof clips)[0]["objects"][0] }[] = [];
    extra.forEach((c, i) => {
      const o = c.objects.find((x) => x.id === id);
      if (o) hits.push({ i, o });
    });
    for (let h = 1; h < hits.length; h++) {
      const a = hits[h - 1];
      const b = hits[h];
      const gap = b.i - a.i;
      if (gap <= 1 || gap > 8) continue;
      for (let k = 1; k < gap; k++) {
        const t = k / gap;
        extra[a.i + k].objects.push({
          ...a.o,
          x: a.o.x + (b.o.x - a.o.x) * t,
          y: a.o.y + (b.o.y - a.o.y) * t,
          w: a.o.w + (b.o.w - a.o.w) * t,
          h: a.o.h + (b.o.h - a.o.h) * t,
          score: (a.o.score + b.o.score) / 2,
        });
      }
    }
  }
  return extra;
}

export function cocoExport() {
  const clips = interpolate();
  const images: unknown[] = [];
  const annotations: unknown[] = [];
  let ann = 1;
  clips.forEach((c, i) => {
    images.push({ id: i + 1, file_name: `frame-${i}.jpg`, width: 640, height: 360 });
    for (const o of c.objects) {
      annotations.push({
        id: ann++,
        image_id: i + 1,
        category_id: o.class,
        bbox: [o.x, o.y, o.w, o.h],
        score: o.score,
        track_id: o.id,
      });
    }
  });
  const body = JSON.stringify({ images, annotations, info: { description: "Aether session" } }, null, 2);
  download("aether-coco.json", body);
  return body;
}

export function geoJsonExport() {
  const feats = roomList().map((m) => ({
    type: "Feature",
    properties: { id: m.id, name: m.name || m.class, missing: m.missing },
    geometry: { type: "Point", coordinates: [m.wx, m.wy] },
  }));
  const body = JSON.stringify({ type: "FeatureCollection", features: feats }, null, 2);
  download("aether-map.geojson", body);
  return body;
}

export function motExport() {
  const clips = sessionClips();
  const lines: string[] = [];
  clips.forEach((c, i) => {
    for (const o of c.objects) {
      if (o.id == null) continue;
      lines.push(`${i + 1},${o.id},${o.x.toFixed(4)},${o.y.toFixed(4)},${o.w.toFixed(4)},${o.h.toFixed(4)},${o.score.toFixed(3)},-1,-1,-1`);
    }
  });
  const body = lines.join("\n");
  download("aether-mot.txt", body, "text/plain");
  return body;
}

export function vttExport() {
  const clips = sessionClips();
  const lines = ["WEBVTT", ""];
  clips.forEach((c, i) => {
    const t0 = (i * 0.4).toFixed(3);
    const t1 = ((i + 1) * 0.4).toFixed(3);
    const names = c.objects.map((o) => `#${o.id ?? "?"} ${o.name || o.class}`).join(", ");
    lines.push(`${t0} --> ${t1}`, names || "—", "");
  });
  const body = lines.join("\n");
  download("aether.vtt", body, "text/vtt");
  return body;
}

export async function hashSession() {
  const raw = sessionJson();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function nmeaExport() {
  const p = getPose();
  const lat = p.y;
  const lon = p.x;
  const t = new Date();
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  const ss = String(t.getUTCSeconds()).padStart(2, "0");
  const body = `$GPGGA,${hh}${mm}${ss}.00,${lat.toFixed(4)},N,${lon.toFixed(4)},W,1,08,1.0,0.0,M,0.0,M,,*00\n`;
  download("aether.nmea", body, "text/plain");
  return body;
}

export async function zipPack() {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const hash = await hashSession();
  zip.file("hash.txt", hash);
  try {
    localStorage.setItem("aether:last-hash", hash);
  } catch {
    /* ignore */
  }
  zip.file("session.json", sessionJson());
  zip.file("coco.json", cocoExportKeep());
  zip.file("map.geojson", geoJsonExportKeep());
  const png = floorplanPng();
  zip.file("floorplan.png", png.split(",")[1], { base64: true });
  zip.file(
    "waypoints.json",
    JSON.stringify({ pose: getPose(), scaleM: metersPerUnit() || null, waypoints: listWaypoints() }, null, 2),
  );
  zip.file("taught.json", JSON.stringify(taughtList().map((t) => ({ name: t.name, classHint: t.classHint, t: t.t })), null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  download("aether-chart.zip", blob, "application/zip");
  return { hash, bytes: blob.size };
}

function cocoExportKeep() {
  const clips = interpolate();
  const images: unknown[] = [];
  const annotations: unknown[] = [];
  let ann = 1;
  clips.forEach((c, i) => {
    images.push({ id: i + 1, file_name: `frame-${i}.jpg` });
    for (const o of c.objects) {
      annotations.push({
        id: ann++,
        image_id: i + 1,
        category_id: o.class,
        bbox: [o.x, o.y, o.w, o.h],
        score: o.score,
        track_id: o.id,
      });
    }
  });
  return JSON.stringify({ images, annotations }, null, 2);
}

function geoJsonExportKeep() {
  const feats = roomList().map((m) => ({
    type: "Feature",
    properties: { id: m.id, name: m.name || m.class },
    geometry: { type: "Point", coordinates: [m.wx, m.wy] },
  }));
  return JSON.stringify({ type: "FeatureCollection", features: feats }, null, 2);
}

export function fieldVaultWalk() {
  const facts = listFacts();
  const wps = listWaypoints();
  const rows = [
    ...facts.map((f) => ({ name: f.k, tag: f.v, notes: f.v, source: "aether-fact" })),
    ...wps.map((w) => ({ name: w.name, tag: w.kind, wx: w.wx, wy: w.wy, source: "aether-wp" })),
    ...roomList().map((m) => ({
      name: m.name || m.class,
      tag: m.class,
      wx: m.wx,
      wy: m.wy,
      source: "aether-room",
    })),
  ];
  const body = JSON.stringify(rows, null, 2);
  download("fieldvault-walkdown.json", body);
  return body;
}

export function fieldVaultRow() {
  const room = roomList()[0];
  const body = JSON.stringify(
    {
      source: "aether",
      t: Date.now(),
      pose: getPose(),
      equipment: room ? { id: room.id, name: room.name || room.class, wx: room.wx, wy: room.wy } : null,
      waypoints: listWaypoints(),
    },
    null,
    2,
  );
  download("fieldvault-row.json", body);
  return body;
}

export function downloadFloorplan() {
  const a = document.createElement("a");
  a.href = floorplanPng();
  a.download = "aether-floorplan.png";
  a.click();
}

export async function chartPack() {
  const hash = await hashSession();
  const body = JSON.stringify(
    {
      hash,
      t: Date.now(),
      pose: getPose(),
      scaleM: metersPerUnit() || null,
      grid: { ...slamGrid(), data: Array.from(slamGrid().data) },
      room: roomList(),
      waypoints: listWaypoints(),
      session: JSON.parse(sessionJson() || "[]"),
    },
    null,
    2,
  );
  download("aether-chart-pack.json", body);
  return { hash, bytes: body.length };
}
