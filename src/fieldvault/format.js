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

/** GPS accuracy worse than this (meters) is flagged on the punch list, not a leave-site blocker. */
export const WEAK_GPS_M = 40;

export function roundHeading(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return null;
  return Math.round(((n % 360) + 360) % 360);
}

export function photoHeading(photo, eq) {
  const direct = roundHeading(photo?.heading ?? eq?.heading);
  if (direct != null) return direct;
  if (photo) return null;
  for (const p of eq?.photos || []) {
    const h = roundHeading(p.heading);
    if (h != null) return h;
  }
  return null;
}

export function photoGpsAcc(photo, eq) {
  const n = Number(photo?.gpsAcc ?? eq?.gpsAcc);
  return Number.isFinite(n) ? n : null;
}

export function bestGpsAccuracyM(eq) {
  let best = null;
  const consider = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return;
    if (best == null || n < best) best = n;
  };
  consider(eq?.gpsAcc);
  for (const p of eq?.photos || []) consider(p.gpsAcc);
  return best;
}

export function hasWeakGps(eq, threshold = WEAK_GPS_M) {
  if (eq?.lat == null || eq?.lng == null) return false;
  const acc = bestGpsAccuracyM(eq);
  if (acc == null) return false;
  return acc > threshold;
}

export function sheetLocation(eq, photo) {
  const loc = (photo && photo.sheet) || (eq && eq.sheet) || null;
  if (!loc || typeof loc !== "object") {
    return { sheet: "", grid: "", planX: "", planY: "", drawingId: "" };
  }
  const x = loc.x;
  const y = loc.y;
  return {
    sheet: String(loc.sheet || loc.name || ""),
    grid: String(loc.grid || ""),
    planX: x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : "",
    planY: y != null && y !== "" && Number.isFinite(Number(y)) ? Number(y) : "",
    drawingId: String(loc.drawingId || ""),
  };
}

export function hasSheetPin(eq, photo) {
  const loc = sheetLocation(eq, photo);
  return !!(loc.sheet || loc.grid || loc.drawingId);
}

/** Area-level GPS cue unless the last pin is on a sheet/grid. */
export function gpsCueText(fix, opts = {}) {
  if (opts.denied) return "GPS blocked";
  if (!fix) return opts.waiting ? "Area GPS…" : "No GPS yet";
  const now = opts.now != null ? Number(opts.now) : Date.now();
  const at = Number(fix.at);
  const age = Number.isFinite(at) ? Math.max(0, Math.round((now - at) / 1000)) : 0;
  const ageStr = age < 5 ? "just now" : age < 60 ? age + "s ago" : Math.round(age / 60) + " min ago";
  const acc = Number(fix.acc);
  const accBit = Number.isFinite(acc) ? " ±" + Math.round(acc) + " m" : "";
  const body = "Area GPS" + accBit + " · " + ageStr;
  return opts.sheetPinned ? "On sheet · " + body : body;
}

export function geoJsonPointProperties(eq, photo, areas) {
  const areaMap = Object.fromEntries((areas || []).map((a) => [a.id, a.name]));
  const loc = sheetLocation(eq, photo);
  return {
    tag: eq?.tag || "",
    type: eq?.eqType || "",
    area: areaMap[eq?.areaId] || "",
    pid: eq?.pid || "",
    readiness: eq?.readiness ?? null,
    visit: "",
    gps_acc: photoGpsAcc(photo, eq),
    heading: photoHeading(photo, eq),
    sheet: loc.sheet,
    grid: loc.grid,
    plan_x: loc.planX,
    plan_y: loc.planY,
  };
}

export function walkGeoJson(visit, items, areas) {
  const features = [];
  for (const eq of items || []) {
    if (eq.lat == null || eq.lng == null) continue;
    const props = geoJsonPointProperties(eq, null, areas);
    props.visit = visit?.title || "";
    props.kind = "equipment";
    features.push({
      type: "Feature",
      properties: props,
      geometry: { type: "Point", coordinates: [Number(eq.lng), Number(eq.lat)] },
    });
    for (const p of eq.photos || []) {
      const lat = p.lat ?? eq.lat;
      const lng = p.lng ?? eq.lng;
      if (lat == null || lng == null) continue;
      const photoProps = geoJsonPointProperties(eq, p, areas);
      photoProps.visit = visit?.title || "";
      photoProps.kind = "photo";
      photoProps.view_type = p.promptType || "";
      features.push({
        type: "Feature",
        properties: photoProps,
        geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
      });
    }
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

export const EQUIPMENT_CSV_HEADER = [
  "tag",
  "type",
  "service",
  "pid",
  "line",
  "mfr",
  "model",
  "serial",
  "area",
  "location",
  "lat",
  "lng",
  "gps_acc",
  "heading",
  "sheet",
  "grid",
  "plan_x",
  "plan_y",
  "notes",
  "readiness",
  "photo_file",
  "view_type",
];

export const PHOTO_INDEX_HEADER = [
  "photo_file",
  "tag",
  "pid",
  "sheet",
  "grid",
  "plan_x",
  "plan_y",
  "view_type",
  "lat",
  "lng",
  "gps_acc",
  "heading",
];

export function equipmentCsvRow(eq, photo, extras = {}) {
  const loc = sheetLocation(eq, photo);
  const lat = photo ? photo.lat ?? eq?.lat : eq?.lat;
  const lng = photo ? photo.lng ?? eq?.lng : eq?.lng;
  return [
    eq?.tag || "",
    eq?.eqType || "",
    eq?.service || "",
    eq?.pid || "",
    eq?.lineNo || "",
    eq?.mfr || "",
    eq?.model || "",
    eq?.serial || "",
    extras.area || "",
    eq?.locationDesc || "",
    lat ?? "",
    lng ?? "",
    photoGpsAcc(photo, eq) ?? "",
    photoHeading(photo, eq) ?? "",
    loc.sheet,
    loc.grid,
    loc.planX,
    loc.planY,
    (photo && photo.note) || eq?.notes || "",
    extras.readiness ?? "",
    extras.photoFile || "",
    (photo && photo.promptType) || "",
  ];
}

export function equipmentCsv(items, areas, fileForPhoto) {
  const areaMap = Object.fromEntries((areas || []).map((a) => [a.id, a.name]));
  const lines = [csvRow(EQUIPMENT_CSV_HEADER)];
  for (const eq of items || []) {
    const area = areaMap[eq.areaId] || "unassigned";
    const photos = eq.photos || [];
    const extras = { area, readiness: eq.readiness ?? "" };
    if (!photos.length) {
      lines.push(csvRow(equipmentCsvRow(eq, null, extras)));
    }
    photos.forEach((p, i) => {
      const photoFile = fileForPhoto ? fileForPhoto(eq, p, i) : "";
      lines.push(csvRow(equipmentCsvRow(eq, p, { ...extras, photoFile })));
    });
  }
  return lines.join("\n") + "\n";
}

export function photoIndexCsv(items, areas, fileForPhoto) {
  const lines = [csvRow(PHOTO_INDEX_HEADER)];
  for (const eq of items || []) {
    (eq.photos || []).forEach((p, i) => {
      const loc = sheetLocation(eq, p);
      lines.push(
        csvRow([
          fileForPhoto ? fileForPhoto(eq, p, i) : "",
          eq.tag || "",
          eq.pid || "",
          loc.sheet,
          loc.grid,
          loc.planX,
          loc.planY,
          p.promptType || "",
          p.lat ?? eq.lat ?? "",
          p.lng ?? eq.lng ?? "",
          photoGpsAcc(p, eq) ?? "",
          photoHeading(p, eq) ?? "",
        ]),
      );
    });
  }
  return lines.join("\n") + "\n";
}

export function placeOnSheetNote() {
  return [
    "How to place FieldVault shots on a drawing",
    "",
    "This pack is for the drawing office. It is not a CAD or PM suite.",
    "",
    "1. Open equipment.csv (or photos/index.csv) in Excel or a GIS tool.",
    "2. pid is the P&ID / drawing number when the engineer typed one.",
    "3. sheet + grid are optional callouts (e.g. P&ID-CU-101 and C-4).",
    "4. plan_x / plan_y are 0–1 from the top-left of an attached plan image, if they tapped one.",
    "5. heading is compass degrees when the phone had a heading. Blank is fine — do not wait on heading.",
    "6. gps_acc is GPS accuracy in meters. Larger numbers are a looser indoor fix.",
    "7. Drop files from photos/ onto the matching sheet using sheet+grid, or overlay visit.geojson.",
    "8. Attached PDF/image plans, if any, are in drawings/.",
    "",
    "Skip is always valid in the field: GPS + tags only.",
  ].join("\n");
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
    if (hasNoteFlag(eq, /blur/i)) reasons.push({ id: "blur", label: "Blurry — retake" });
    if (hasNoteFlag(eq, /duplicate/i)) reasons.push({ id: "dup", label: "Looks like a duplicate" });
    if (hasNoteFlag(eq, /leak/i)) reasons.push({ id: "leak", label: "Possible leak / rust" });
    if (!hasSheetPin(eq)) reasons.push({ id: "unpinned", label: "Not on a sheet / grid" });
  }
  if (eq?.lat == null || eq?.lng == null) reasons.push({ id: "gps", label: "No GPS" });
  else if (hasWeakGps(eq)) {
    const acc = bestGpsAccuracyM(eq);
    reasons.push({ id: "weakgps", label: "Weak GPS (±" + Math.round(acc) + " m)" });
  }
  if (eq?.needsFollowup) reasons.push({ id: "followup", label: "Follow-up flagged" });
  return reasons;
}

export function hasNoteFlag(eq, re) {
  return (eq?.photos || []).some((p) => re.test(String(p.note || "")));
}

export function officePassItems(items) {
  return (items || []).filter((eq) => officePassReasons(eq).length > 0).sort(compareEquipmentWalkOrder);
}

/** Punch-list hints that should not stop Leave site (weak GPS, unpinned sheet, never heading). */
export const LEAVE_SITE_SOFT_REASONS = new Set(["weakgps", "unpinned"]);

export function leaveSiteBlockers(items) {
  return (items || [])
    .filter((eq) => officePassReasons(eq).some((r) => !LEAVE_SITE_SOFT_REASONS.has(r.id)))
    .sort(compareEquipmentWalkOrder);
}

export function isAreaDay1Done(area) {
  return !!(area && area.day1Done);
}

/**
 * Optional two-day split from existing visit areas.
 * Unused until at least one area is marked day1Done — same visit, punch items stay open.
 */
export function coverageByArea(areas, items) {
  const list = Array.isArray(areas) ? areas.slice() : [];
  const day1Done = list.filter(isAreaDay1Done);
  const day2Remaining = list.filter((a) => !isAreaDay1Done(a));
  return {
    used: day1Done.length > 0,
    day1Done,
    day2Remaining,
    punchOpen: officePassItems(items),
  };
}

export function coverageSummary(plan) {
  if (!plan || !plan.used) return "";
  const d1 = (plan.day1Done || []).length;
  const d2 = (plan.day2Remaining || []).length;
  const p = (plan.punchOpen || []).length;
  const punchBit = p
    ? p + " punch item" + (p === 1 ? "" : "s") + " still open on this visit"
    : "no open punch items";
  return (
    "Day 1: " +
    d1 +
    " area" +
    (d1 === 1 ? "" : "s") +
    " done · Day 2: " +
    d2 +
    " remaining · " +
    punchBit
  );
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
  if (!suggestion) return "Area GPS will pick the nearest pin";
  if (suggestion.how === "pin") {
    if (suggestion.reason === "moved") {
      return "New pin in this area · you moved " + Math.round(suggestion.moved) + " m";
    }
    if (suggestion.reason === "waited") return "New pin in this area · been a minute";
    if (suggestion.reason === "forced") return "Next snap starts a new pin";
    return "New pin in this area";
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

/** Prior plant tags and P&ID / sheet names for datalist suggest. */
export function uniqueOfficeNames(items) {
  const tags = [];
  const pids = [];
  const seenT = new Set();
  const seenP = new Set();
  for (const e of items || []) {
    const tag = String(e.tag || "").trim();
    if (tag && !isUntitledTag(tag)) {
      const k = tag.toLowerCase();
      if (!seenT.has(k)) {
        seenT.add(k);
        tags.push(tag);
      }
    }
    const parsed = parseNameplateText(e.tag || e.notes || "");
    if (parsed.tag) {
      const k = parsed.tag.toLowerCase();
      if (!seenT.has(k)) {
        seenT.add(k);
        tags.push(parsed.tag);
      }
    }
    const pid = String(e.pid || sheetLocation(e).sheet || "").trim();
    if (pid) {
      const k = pid.toLowerCase();
      if (!seenP.has(k)) {
        seenP.add(k);
        pids.push(pid);
      }
    }
  }
  return { tags, pids };
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

export function parseSpokenTag(raw) {
  const text = String(raw || "")
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/\b(DASH|HYPHEN|MINUS)\b/g, "-");
  const tagged = text.match(/\b([A-Z]{1,3})\s*-?\s*(\d{2,5}[A-Z]?)\b/);
  if (tagged && !/^(PIN|THE|AND|FOR|ARE|WAS)$/.test(tagged[1])) {
    return tagged[1] + "-" + tagged[2];
  }
  return "";
}

export function parseSpokenName(raw) {
  const tag = parseSpokenTag(raw);
  if (tag) return tag;
  const m = String(raw || "").match(/(?:that(?:'s| is)|name(?:d| it)?|call it|tag)\s+(.+)/i);
  if (!m) return "";
  return m[1].replace(/[.]/g, "").trim().slice(0, 40);
}

export function nextWalkGap(items, lat, lng) {
  const gaps = leaveSiteBlockers(items);
  if (!gaps.length) return null;
  const withGps = gaps.filter((e) => e.lat != null && e.lng != null);
  const pool = withGps.length ? withGps : gaps;
  if (lat == null || lng == null || !withGps.length) {
    const eq = pool[0];
    return { eq, dist: null, reason: officePassReasons(eq)[0] || null };
  }
  let best = pool[0];
  let bestD = Infinity;
  for (const eq of pool) {
    if (eq.lat == null) continue;
    const d = haversineM(lat, lng, eq.lat, eq.lng);
    if (d < bestD) {
      best = eq;
      bestD = d;
    }
  }
  return { eq: best, dist: bestD, reason: officePassReasons(best)[0] || null };
}

export function walkGapText(gap) {
  if (!gap || !gap.eq) return "Walk is clear";
  const tag = gap.eq.tag || "pin";
  const why = gap.reason?.label || "needs attention";
  if (gap.dist != null && Number.isFinite(gap.dist)) {
    return Math.round(gap.dist) + " m to " + tag + " · " + why;
  }
  return tag + " · " + why;
}

export function hammingHex(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const n = Math.max(left.length, right.length);
  let d = 0;
  for (let i = 0; i < n; i++) {
    const x = parseInt(left[i] || "0", 16) ^ parseInt(right[i] || "0", 16);
    d += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  return d;
}

export function dHashFromGray(gray, size = 8) {
  let bits = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * (size + 1) + x;
      bits += gray[i] > gray[i + 1] ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function isBlurryVar(laplacianVar, threshold = 90) {
  return laplacianVar < threshold;
}

export function mapImportRow(row) {
  const r = row && typeof row === "object" ? row : {};
  const tag = String(r.tag || r.name || r.equipment || r.title || "").trim();
  const lat = Number(r.lat ?? r.latitude);
  const lng = Number(r.lng ?? r.lon ?? r.longitude);
  const pid = String(r.pid || r.pandid || r.drawing || r.sheet || "").trim();
  return {
    tag,
    notes: String(r.notes || r.area || r.v || ""),
    area: String(r.area || ""),
    eqType: String(r.eqType || r.type || r.kind || "other"),
    pid,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    source: String(r.source || "import"),
  };
}

/** Split CSV/TSV into row objects for mapImportRow (optional tag preload). */
export function parseImportCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const splitLine = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else q = !q;
      } else if ((ch === "," || ch === "\t") && !q) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const header = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").toLowerCase());
  const looksHeader = header.some((h) => /^(tag|name|equipment|title|pid|sheet|area|lat|lng)$/.test(h));
  const keys = looksHeader ? header : null;
  const start = looksHeader ? 1 : 0;
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (keys) {
      const row = {};
      keys.forEach((k, j) => {
        row[k] = cells[j];
      });
      rows.push(row);
    } else {
      rows.push({ tag: cells[0], pid: cells[1], area: cells[2] });
    }
  }
  return rows;
}
