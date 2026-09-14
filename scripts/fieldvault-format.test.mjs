import assert from "node:assert/strict";
import test from "node:test";
import {
  clusterByAccuracy,
  csvCell,
  csvRow,
  facilityKey,
  mapImportRow,
  parseNameplateText,
  punchItems,
  coverageByArea,
  coverageSummary,
  isAreaDay1Done,
  uniqueFacilities,
  walkGeoJson,
  walkLine,
  nearestByGps,
  isUntitledTag,
  suggestAttachTarget,
  attachPreviewText,
  officePassItems,
  officePassReasons,
  leaveSiteBlockers,
  hasWeakGps,
  equipmentCsv,
  photoIndexCsv,
  placeOnSheetNote,
  sheetLocation,
  photoHeading,
  photoGpsAcc,
  WEAK_GPS_M,
  compareTags,
  compareEquipmentWalkOrder,
  rushShotType,
  SPLIT_WAIT_MS,
  parseSpokenTag,
  parseSpokenName,
  nextWalkGap,
  walkGapText,
  hammingHex,
  dHashFromGray,
  isBlurryVar,
} from "../src/fieldvault/format.js";

test("csvCell quotes commas and doubles inner quotes", () => {
  assert.equal(csvCell("ok"), '"ok"');
  assert.equal(csvCell('8" line, north'), '"8"" line, north"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvRow(["P-101", 'say "hi"']), '"P-101","say ""hi"""');
});

test("clusterByAccuracy widens radius for sloppy fixes", () => {
  const items = [
    { id: "a", lat: 29.7362, lng: -95.0128, gpsAcc: 8 },
    { id: "b", lat: 29.73625, lng: -95.01285, gpsAcc: 8 },
    { id: "c", lat: 29.74, lng: -95.02, gpsAcc: 8 },
  ];
  const tight = clusterByAccuracy(items, 25);
  assert.equal(tight.length, 2);

  const sloppy = clusterByAccuracy(
    [
      { id: "a", lat: 29.7362, lng: -95.0128, gpsAcc: 140 },
      { id: "c", lat: 29.7368, lng: -95.0136, gpsAcc: 140 },
    ],
    25,
  );
  assert.equal(sloppy.length, 1);
});

test("walk line and geojson include GPS points and a path", () => {
  const items = [
    {
      tag: "P-101",
      lat: 29.7,
      lng: -95.0,
      photos: [{ capturedAt: 2, lat: 29.7, lng: -95.0 }],
    },
    {
      tag: "E-210",
      lat: 29.71,
      lng: -95.01,
      photos: [{ capturedAt: 1, lat: 29.71, lng: -95.01 }],
    },
  ];
  const line = walkLine(items);
  assert.equal(line.length, 2);
  assert.equal(line[0].eq.tag, "E-210");
  const gj = walkGeoJson({ title: "Crude" }, items, []);
  const points = gj.features.filter((f) => f.geometry.type === "Point");
  const lines = gj.features.filter((f) => f.geometry.type === "LineString");
  assert.equal(lines.length, 1);
  assert.ok(points.length >= 2);
  assert.equal("gps_acc" in points[0].properties, true);
  assert.equal("heading" in points[0].properties, true);
});

test("nameplate parse pulls a plant tag", () => {
  const got = parseNameplateText("FLOWTEC  MODEL FT-80  P-101  S/N A18422");
  assert.equal(got.tag, "P-101");
  assert.equal(got.model, "FT-80");
  assert.equal(got.serial, "A18422");
});

test("import rows map GPS without the 0.002 sketch hack", () => {
  const row = mapImportRow({ name: "P-101", latitude: 29.7, longitude: -95.1, notes: "charge" });
  assert.equal(row.tag, "P-101");
  assert.equal(row.lat, 29.7);
  assert.equal(row.lng, -95.1);
});

test("suggestAttachTarget stays, splits on move, and waits", () => {
  const last = { id: "p", tag: "P-101", lat: 29.7362, lng: -95.0128, gpsAcc: 8, photos: [{}] };
  const stay = suggestAttachTarget({
    items: [last],
    lat: 29.73621,
    lng: -95.01281,
    acc: 8,
    lastPin: last,
    lastShotAt: Date.now() - 5000,
  });
  assert.equal(stay.how, "current");
  assert.match(attachPreviewText(stay), /Adding to P-101/);

  const moved = suggestAttachTarget({
    items: [last],
    lat: 29.7366,
    lng: -95.0134,
    acc: 8,
    lastPin: last,
    lastShotAt: Date.now() - 5000,
  });
  assert.equal(moved.how, "pin");
  assert.equal(moved.reason, "moved");

  const waited = suggestAttachTarget({
    items: [last],
    lat: 29.73621,
    lng: -95.01281,
    acc: 8,
    lastPin: last,
    lastShotAt: Date.now() - SPLIT_WAIT_MS - 1000,
  });
  assert.equal(waited.how, "pin");
  assert.equal(waited.reason, "waited");

  const locked = suggestAttachTarget({
    items: [last],
    lat: 29.74,
    lng: -95.02,
    acc: 8,
    lastPin: last,
    lockCurrent: true,
  });
  assert.equal(locked.how, "current");
});

test("office pass and walk-order helpers", () => {
  assert.ok(compareTags("Pin 2", "Pin 10") < 0);
  const a = { tag: "Pin 2", createdAt: 20, photos: [{ capturedAt: 20 }] };
  const b = { tag: "P-101", createdAt: 10, photos: [{ capturedAt: 10 }] };
  assert.equal(compareEquipmentWalkOrder(b, a) < 0, true);
  assert.equal(rushShotType([]), "overall");
  assert.equal(rushShotType([{}]), "tag");
  const items = officePassItems([
    { tag: "P-101", photos: [{ note: "" }], lat: 1, lng: 2 },
    { tag: "Pin 1", photos: [{ note: "Possibly dark" }], lat: null, lng: null },
  ]);
  assert.equal(items[0].tag, "Pin 1");
  const reasons = officePassReasons(items[0]).map((r) => r.id);
  assert.ok(reasons.includes("untitled"));
  assert.ok(reasons.includes("dark"));
  assert.ok(reasons.includes("gps"));
  const blurry = officePassReasons({ tag: "P-101", photos: [{ note: "Blurry" }], lat: 1, lng: 2 });
  assert.ok(blurry.some((r) => r.id === "blur"));
});

test("nearestByGps picks the close tag and ignores far ones", () => {
  const items = [
    { id: "p", tag: "P-101", lat: 29.7362, lng: -95.0128, gpsAcc: 8 },
    { id: "x", tag: "XV-402", lat: 29.74, lng: -95.02, gpsAcc: 8 },
  ];
  const hit = nearestByGps(items, 29.73621, -95.01281, 18);
  assert.equal(hit?.eq.tag, "P-101");
  assert.equal(nearestByGps(items, 29.75, -95.03, 18), null);
  assert.equal(isUntitledTag("Pin 3"), true);
  assert.equal(isUntitledTag("P-101"), false);
});

test("facilities and punch list helpers", () => {
  const visits = [
    { client: "Gulf", facility: "Crude" },
    { client: "Gulf", facility: "Crude" },
    { client: "Gulf", facility: "Alky" },
  ];
  assert.equal(uniqueFacilities(visits).length, 2);
  assert.equal(facilityKey(visits[0]), "gulf||crude");
  const punch = punchItems([
    { tag: "P-101", photos: [{}], needsFollowup: false },
    { tag: "XV-402", photos: [], needsFollowup: true },
    { tag: "V-301", photos: [{}], condition: "Poor" },
  ]);
  assert.deepEqual(
    punch.map((e) => e.tag),
    ["XV-402", "V-301"],
  );
});

test("spoken nameplate becomes a tag", () => {
  assert.equal(parseSpokenTag("this is XV dash 402"), "XV-402");
  assert.equal(parseSpokenName("nameplate is PCV 12"), "PCV-12");
  assert.equal(parseSpokenName("call it Charge pump"), "Charge pump");
});

test("next walk gap is nearest pin that still needs work", () => {
  const gap = nextWalkGap(
    [
      { tag: "A", lat: 0, lng: 0, photos: [{}] },
      { tag: "B", lat: 0, lng: 0.001, photos: [] },
      { tag: "C", lat: 0, lng: 0.01, photos: [] },
    ],
    0,
    0,
  );
  assert.equal(gap?.eq.tag, "B");
  assert.match(walkGapText(gap), /B/);
});

test("optional two-day coverage uses areas on one visit and keeps punch items", () => {
  const areas = [
    { id: "pumps", name: "Pump area" },
    { id: "vessels", name: "Vessels" },
    { id: "rack", name: "Pipe rack" },
  ];
  const items = [
    { id: "v", tag: "V-301", areaId: "pumps", needsFollowup: true, photos: [{}], lat: 1, lng: 2 },
    { id: "x", tag: "XV-402", areaId: "rack", photos: [], lat: null, lng: null },
    { id: "ok", tag: "P-101", areaId: "pumps", photos: [{}], lat: 1, lng: 2 },
  ];

  assert.equal(isAreaDay1Done(null), false);
  assert.equal(isAreaDay1Done({}), false);

  const unused = coverageByArea(areas, items);
  assert.equal(unused.used, false);
  assert.equal(unused.day1Done.length, 0);
  assert.equal(unused.day2Remaining.length, 3);
  assert.equal(coverageSummary(unused), "");
  assert.ok(unused.punchOpen.some((e) => e.tag === "V-301"));
  assert.ok(unused.punchOpen.some((e) => e.tag === "XV-402"));
  assert.ok(!unused.punchOpen.some((e) => e.tag === "P-101"));

  const used = coverageByArea(
    areas.map((a) => (a.id === "pumps" ? { ...a, day1Done: true } : a)),
    items,
  );
  assert.equal(used.used, true);
  assert.equal(isAreaDay1Done(used.day1Done[0]), true);
  assert.deepEqual(
    used.day1Done.map((a) => a.name),
    ["Pump area"],
  );
  assert.deepEqual(
    used.day2Remaining.map((a) => a.name),
    ["Vessels", "Pipe rack"],
  );
  assert.ok(used.punchOpen.some((e) => e.tag === "V-301"));
  assert.ok(used.punchOpen.some((e) => e.tag === "XV-402"));
  assert.match(coverageSummary(used), /Day 1: 1 area done/);
  assert.match(coverageSummary(used), /Day 2: 2 remaining/);
  assert.match(coverageSummary(used), /2 punch items still open on this visit/);
});

test("per-shot heading and gps_acc land on CSV, GeoJSON, and punch list without blocking leave", () => {
  const eq = {
    tag: "P-101",
    eqType: "pump",
    pid: "P&ID-CU-101",
    areaId: "pumps",
    lat: 29.7,
    lng: -95.0,
    gpsAcc: 8,
    heading: 42,
    photos: [{ promptType: "overall", lat: 29.7, lng: -95.0, gpsAcc: 8, heading: 42, capturedAt: 1 }],
  };
  const weak = {
    tag: "XV-402",
    lat: 29.71,
    lng: -95.01,
    gpsAcc: 90,
    photos: [{ promptType: "overall", lat: 29.71, lng: -95.01, gpsAcc: 90, capturedAt: 2 }],
  };
  assert.equal(photoHeading(eq.photos[0], eq), 42);
  assert.equal(photoGpsAcc(eq.photos[0], eq), 8);
  assert.equal(hasWeakGps(eq), false);
  assert.equal(hasWeakGps(weak), true);
  assert.ok(WEAK_GPS_M >= 25);

  const csv = equipmentCsv([eq], [{ id: "pumps", name: "Pump area" }], () => "photos/Pump_area/P-101/P-101_overall_1.jpg");
  assert.match(csv, /^"tag".*"gps_acc","heading"/m);
  assert.match(csv, /"8","42"/);
  assert.match(csv, /"P&ID-CU-101"/);

  const index = photoIndexCsv([eq], [], () => "photos/Pump_area/P-101/P-101_overall_1.jpg");
  assert.match(index, /"heading"/);
  assert.match(index, /"8","42"/);

  const gj = walkGeoJson({ title: "Crude" }, [eq], [{ id: "pumps", name: "Pump area" }]);
  const photoFeat = gj.features.find((f) => f.properties.kind === "photo");
  assert.equal(photoFeat.properties.heading, 42);
  assert.equal(photoFeat.properties.gps_acc, 8);
  assert.equal(photoFeat.properties.pid, "P&ID-CU-101");

  const weakReasons = officePassReasons(weak).map((r) => r.id);
  assert.ok(weakReasons.includes("weakgps"));
  assert.ok(!officePassReasons(eq).some((r) => r.id === "weakgps"));
  assert.ok(!officePassReasons(eq).some((r) => r.id === "heading"));
  assert.equal(leaveSiteBlockers([eq, weak]).length, 0);
  assert.equal(nextWalkGap([eq, weak], 29.7, -95), null);
  assert.ok(officePassItems([eq, weak]).some((e) => e.tag === "XV-402"));
  assert.match(placeOnSheetNote(), /sheet \+ grid/i);
});

test("optional sheet location is skippable and serializes for drawings", () => {
  const bare = { tag: "P-101", photos: [{}] };
  assert.deepEqual(sheetLocation(bare, bare.photos[0]), {
    sheet: "",
    grid: "",
    planX: "",
    planY: "",
    drawingId: "",
  });
  const pinned = {
    tag: "P-101",
    pid: "P&ID-CU-101",
    sheet: { sheet: "P&ID-CU-101", grid: "C-4", x: 0.42, y: 0.31, drawingId: "d1" },
    photos: [{ sheet: { sheet: "P&ID-CU-101", grid: "C-4", x: 0.42, y: 0.31, drawingId: "d1" } }],
  };
  const loc = sheetLocation(pinned, pinned.photos[0]);
  assert.equal(loc.sheet, "P&ID-CU-101");
  assert.equal(loc.grid, "C-4");
  assert.equal(loc.planX, 0.42);
  const csv = equipmentCsv([pinned], [], () => "photos/x.jpg");
  assert.match(csv, /"C-4"/);
  assert.match(csv, /"0.42"/);
});

test("dHash and blur helpers", () => {
  const a = Array.from({ length: 72 }, () => 40);
  const b = Array.from({ length: 72 }, () => 41);
  const ha = dHashFromGray(a, 8);
  const hb = dHashFromGray(b, 8);
  assert.equal(ha.length, 16);
  assert.ok(hammingHex(ha, hb) <= 8);
  assert.equal(isBlurryVar(10), true);
  assert.equal(isBlurryVar(200), false);
});
