// @ts-nocheck
/** Pure FieldVault helpers — safe to unit-test without a browser. */

export function csvCell(value) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

/**
 * Cluster GPS-tagged items. Radius grows with reported accuracy so a ±40 m
 * indoor fix does not invent a tight plant area.
 */
export function clusterByAccuracy(items, baseRadiusM = 25) {
  const pts = (items || []).filter((e) => e && e.lat != null && e.lng != null);
  const used = new Set();
  const clusters = [];

  function radiusFor(a, b) {
    const acc = Math.max(Number(a.gpsAcc) || 0, Number(b.gpsAcc) || 0);
    return Math.max(baseRadiusM, acc * 1.15);
  }

  for (let i = 0; i < pts.length; i++) {
    if (used.has(pts[i].id)) continue;
    const group = [pts[i]];
    used.add(pts[i].id);
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < pts.length; j++) {
        if (used.has(pts[j].id)) continue;
        const near = group.some((g) => haversineM(g.lat, g.lng, pts[j].lat, pts[j].lng) <= radiusFor(g, pts[j]));
        if (near) {
          group.push(pts[j]);
          used.add(pts[j].id);
          grew = true;
        }
      }
    }
    clusters.push(group);
  }
  return clusters;
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function walkEvents(items) {
  const events = [];
  for (const eq of items || []) {
    const photos = eq.photos || [];
    if (!photos.length) {
      if (eq.lat != null && eq.lng != null) {
        events.push({
          t: eq.createdAt || eq.updatedAt || 0,
          kind: "eq",
          eq,
          lat: eq.lat,
          lng: eq.lng,
        });
      }
    } else {
      for (const p of photos) {
        const lat = p.lat ?? eq.lat;
        const lng = p.lng ?? eq.lng;
        events.push({
          t: p.capturedAt || eq.createdAt || 0,
          kind: "photo",
          eq,
          photo: p,
          lat,
          lng,
        });
      }
    }
  }
  events.sort((a, b) => a.t - b.t);
  return events;
}

export function walkLine(items) {
  return walkEvents(items).filter((e) => e.lat != null && e.lng != null);
}

export function walkGeoJson(visit, items, areas) {
  const areaMap = Object.fromEntries((areas || []).map((a) => [a.id, a.name]));
  const features = [];
  for (const eq of items || []) {
    if (eq.lat == null || eq.lng == null) continue;
    features.push({
      type: "Feature",
      properties: {
        tag: eq.tag || "",
        type: eq.eqType || "",
        area: areaMap[eq.areaId] || "",
        readiness: eq.readiness ?? null,
        visit: visit?.title || "",
      },
      geometry: { type: "Point", coordinates: [Number(eq.lng), Number(eq.lat)] },
    });
  }
  const line = walkLine(items);
  if (line.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "walk", visit: visit?.title || "" },
      geometry: {
        type: "LineString",
        coordinates: line.map((e) => [Number(e.lng), Number(e.lat)]),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function punchItems(items) {
  return (items || []).filter((eq) => {
    const photos = eq.photos || [];
    const miss = eq.missingRequired || [];
    return (
      eq.needsFollowup ||
      !photos.length ||
      miss.length > 0 ||
      eq.condition === "Poor" ||
      eq.condition === "Critical" ||
      eq.priority === "High" ||
      eq.priority === "Urgent"
    );
  });
}

export function nearestByGps(items, lat, lng, maxM = 18) {
  if (lat == null || lng == null) return null;
  let best = null;
  let bestD = Infinity;
  for (const eq of items || []) {
    if (eq.lat == null || eq.lng == null) continue;
    const d = haversineM(lat, lng, eq.lat, eq.lng);
    const acc = Math.max(Number(eq.gpsAcc) || 0, 0);
    const limit = Math.max(maxM, acc * 1.1);
    if (d <= limit && d < bestD) {
      best = eq;
      bestD = d;
    }
  }
  return best ? { eq: best, dist: bestD } : null;
}

export function isUntitledTag(tag) {
  return /^(pin|pump|valve|tank|other|untitled)\s*\d*$/i.test(String(tag || "").trim());
}

export const ATTACH_BASE_M = 18;
export const SPLIT_MOVE_M = 10;
export const SPLIT_WAIT_MS = 75000;

export function attachRadiusM(acc, base = ATTACH_BASE_M) {
  return Math.max(base, Number(acc) * 1.1 || base);
}

export function splitDistanceM(acc) {
  return Math.max(SPLIT_MOVE_M, (Number(acc) || 0) * 0.85);
}

export function pinNumber(tag) {
  const m = /^(?:pin|untitled)\s+(\d+)$/i.exec(String(tag || "").trim());
  return m ? Number(m[1]) : null;
}

export function compareTags(a, b) {
  const na = pinNumber(a);
  const nb = pinNumber(b);
  if (na != null && nb != null && na !== nb) return na - nb;
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

export function firstCaptureAt(eq) {
  const times = (eq?.photos || []).map((p) => p.capturedAt || 0).filter(Boolean);
  if (times.length) return Math.min(...times);
  return eq?.createdAt || eq?.updatedAt || 0;
}

export function compareEquipmentWalkOrder(a, b) {
  const d = firstCaptureAt(a) - firstCaptureAt(b);
  if (d) return d;
  return compareTags(a?.tag, b?.tag);
}

export function hasDarkPhoto(eq) {
  return (eq?.photos || []).some((p) => /dark/i.test(String(p.note || "")));
}

export function officePassReasons(eq) {
  const reasons = [];
  if (isUntitledTag(eq?.tag)) reasons.push({ id: "untitled", label: "Needs a name" });
  if (!(eq?.photos || []).length) reasons.push({ id: "nophoto", label: "No photos" });
  else {
    const miss = eq.missingRequired || [];
    if (miss.length) {
      reasons.push({
        id: "shots",
        label: "Still needs: " + miss.map((s) => s.label || s.id || s).join(", "),
      });
    }
    if (hasDarkPhoto(eq)) reasons.push({ id: "dark", label: "Dark photo — retake" });
  }
  if (eq?.lat == null || eq?.lng == null) reasons.push({ id: "gps", label: "No GPS" });
  if (eq?.needsFollowup) reasons.push({ id: "followup", label: "Follow-up flagged" });
  return reasons;
}

export function officePassItems(items) {
  return (items || []).filter((eq) => officePassReasons(eq).length > 0).sort(compareEquipmentWalkOrder);
}

export function rushShotType(photos, pending) {
  if (pending) return pending;
  const n = (photos || []).length;
  if (n === 0) return "overall";
  if (n === 1) return "tag";
  return null;
}

/**
 * Decide whether this fix stays on the last pin, snaps to a nearby tag,
 * or starts a new untitled pin. Movement uses GPS accuracy so indoor
 * jumps do not invent extra pins; a long pause still splits.
 */
export function suggestAttachTarget(opts = {}) {
  const {
    items = [],
    lat,
    lng,
    acc,
    forceNew = false,
    lastPin = null,
    lastShotAt = null,
    now = Date.now(),
    lockCurrent = false,
  } = opts;

  if (forceNew) return { how: "pin", reason: "forced" };
  if (lockCurrent && lastPin) {
    const dist = lastPin.lat != null && lat != null ? haversineM(lat, lng, lastPin.lat, lastPin.lng) : null;
    return { how: "current", eq: lastPin, dist, reason: "locked" };
  }

  const moved =
    lastPin && lastPin.lat != null && lat != null ? haversineM(lat, lng, lastPin.lat, lastPin.lng) : null;
  const waited = lastShotAt != null ? now - lastShotAt : 0;
  const splitM = splitDistanceM(acc);

  if (lastPin && moved != null && moved <= splitM) {
    if (waited >= SPLIT_WAIT_MS) return { how: "pin", reason: "waited", moved };
    return { how: "current", eq: lastPin, dist: moved, reason: "still-here" };
  }

  if (lastPin && moved != null && moved > splitM) {
    const near = lat != null ? nearestByGps(items, lat, lng, attachRadiusM(acc)) : null;
    if (near && near.eq.id !== lastPin.id) {
      return { how: "near", eq: near.eq, dist: near.dist, reason: "nearest" };
    }
    return { how: "pin", reason: "moved", moved };
  }

  const near = lat != null ? nearestByGps(items, lat, lng, attachRadiusM(acc)) : null;
  if (near) return { how: "near", eq: near.eq, dist: near.dist, reason: "nearest" };
  return { how: "pin", reason: "none" };
}

export function attachPreviewText(suggestion) {
  if (!suggestion) return "GPS will pick the nearest pin";
  if (suggestion.how === "pin") {
    if (suggestion.reason === "moved") {
      return "New pin · you moved " + Math.round(suggestion.moved) + " m";
    }
    if (suggestion.reason === "waited") return "New pin · been a minute";
    if (suggestion.reason === "forced") return "Next snap starts a new pin";
    return "New pin at this spot";
  }
  const tag = suggestion.eq?.tag || "this tag";
  const d = suggestion.dist != null ? " · " + Math.round(suggestion.dist) + " m" : "";
  const n = (suggestion.eq?.photos || []).length;
  const next = n === 1 ? " · next: nameplate" : "";
  return "Adding to " + tag + d + next;
}

export function facilityKey(visit) {
  const client = String(visit?.client || "").trim();
  const facility = String(visit?.facility || "").trim();
  if (!client && !facility) return "";
  return `${client}||${facility}`.toLowerCase();
}

export function uniqueFacilities(visits) {
  const seen = new Set();
  const out = [];
  for (const v of visits || []) {
    const key = facilityKey(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ client: v.client || "", facility: v.facility || "" });
  }
  return out;
}

export function parseNameplateText(raw) {
  const text = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 \-./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2) return {};
  const tag =
    text.match(/\b((?:P|K|E|V|TK|XV|HV|PSV|LT|PT)-\d{2,5}[A-Z]?)\b/) ||
    text.match(/\b([A-Z]{1,3}-\d{2,5}[A-Z]?)\b/);
  const serial = text.match(/\b(?:S\/N|SN|SERIAL)\s*([A-Z0-9\-]{3,})\b/);
  const model = text.match(/\b(?:MODEL|MOD)\s*([A-Z0-9\-\/.]{2,})\b/);
  const words = text.split(" ").filter((w) => w.length > 2);
  return {
    text,
    tag: tag ? tag[1] : undefined,
    serial: serial ? serial[1] : undefined,
    model: model ? model[1] : undefined,
    hint: words.slice(0, 6).join(" "),
  };
}

export function mapImportRow(row) {
  const r = row && typeof row === "object" ? row : {};
  const tag = String(r.tag || r.name || r.equipment || r.title || "").trim();
  const lat = Number(r.lat ?? r.latitude);
  const lng = Number(r.lng ?? r.lon ?? r.longitude);
  return {
    tag,
    notes: String(r.notes || r.area || r.v || ""),
    area: String(r.area || ""),
    eqType: String(r.eqType || r.type || r.kind || "other"),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    source: String(r.source || "import"),
  };
}
