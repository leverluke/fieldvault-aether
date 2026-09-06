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
  uniqueFacilities,
  walkGeoJson,
  walkLine,
  nearestByGps,
  isUntitledTag,
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
  assert.equal(gj.features.length, 3);
  assert.equal(gj.features[2].geometry.type, "LineString");
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
