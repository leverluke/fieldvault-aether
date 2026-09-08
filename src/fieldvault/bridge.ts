import {
  DB_NAME,
  DB_VERSION,
  STORE_AREAS,
  STORE_EQUIPMENT,
  STORE_PHOTOS,
  STORE_VISITS,
} from "./schema.js";
import { mapImportRow, walkGeoJson } from "./format.js";

type Visit = Record<string, unknown> & { id: string };
type Area = Record<string, unknown> & { id: string; visitId: string };
type Equipment = Record<string, unknown> & { id: string; visitId: string; photos?: unknown[] };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_VISITS)) {
        const vs = database.createObjectStore(STORE_VISITS, { keyPath: "id" });
        vs.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!database.objectStoreNames.contains(STORE_AREAS)) {
        const as = database.createObjectStore(STORE_AREAS, { keyPath: "id" });
        as.createIndex("visitId", "visitId", { unique: false });
      }
      if (!database.objectStoreNames.contains(STORE_EQUIPMENT)) {
        const es = database.createObjectStore(STORE_EQUIPMENT, { keyPath: "id" });
        es.createIndex("visitId", "visitId", { unique: false });
        es.createIndex("areaId", "areaId", { unique: false });
      }
      if (!database.objectStoreNames.contains(STORE_PHOTOS)) {
        database.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function all<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

function put(db: IDBDatabase, store: string, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function listFieldVaultVisits() {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const visits = await all<Visit>(db, STORE_VISITS);
    visits.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return visits;
  } finally {
    db.close();
  }
}

export async function exportFieldVaultRows(visitId?: string) {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const visits = await all<Visit>(db, STORE_VISITS);
    const areas = await all<Area>(db, STORE_AREAS);
    const equipment = await all<Equipment>(db, STORE_EQUIPMENT);
    const visit = visitId
      ? visits.find((v) => v.id === visitId)
      : visits.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    const items = equipment.filter((e) => !visit || e.visitId === visit.id);
    const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));
    return items.map((e) => ({
      tag: e.tag,
      name: e.tag,
      notes: e.notes,
      area: areaMap[String(e.areaId || "")] || "",
      eqType: e.eqType,
      lat: e.lat,
      lng: e.lng,
      readiness: e.readiness,
      source: "fieldvault",
      visit: visit?.title || "",
    }));
  } finally {
    db.close();
  }
}

export async function exportFieldVaultGeoJson(visitId?: string) {
  if (typeof indexedDB === "undefined") return { type: "FeatureCollection", features: [] };
  const db = await openDb();
  try {
    const visits = await all<Visit>(db, STORE_VISITS);
    const areas = await all<Area>(db, STORE_AREAS);
    const equipment = await all<Equipment>(db, STORE_EQUIPMENT);
    const visit = visitId
      ? visits.find((v) => v.id === visitId)
      : visits.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
    const items = equipment.filter((e) => !visit || e.visitId === visit.id);
    return walkGeoJson(visit, items, areas.filter((a) => !visit || a.visitId === visit.id));
  } finally {
    db.close();
  }
}

export async function writeRowsToFieldVault(raw: unknown) {
  if (typeof indexedDB === "undefined") return 0;
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const mapped = rows.map(mapImportRow).filter((r) => r.tag);
  if (!mapped.length) return 0;
  const db = await openDb();
  try {
    const visits = await all<Visit>(db, STORE_VISITS);
    visits.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    let visit = visits[0];
    const now = Date.now();
    if (!visit) {
      visit = {
        id: uid(),
        title: "Imported walkdown",
        date: new Date().toISOString().slice(0, 10),
        overallNotes: "Imported from Aether / Eyes",
        template: "walkdown",
        createdAt: now,
        updatedAt: now,
      };
      await put(db, STORE_VISITS, visit);
    }
    const existing = (await all<Equipment>(db, STORE_EQUIPMENT)).filter((e) => e.visitId === visit.id);
    let n = 0;
    for (const row of mapped) {
      const prior = existing.find((e) => String(e.tag || "").toLowerCase() === row.tag.toLowerCase());
      if (prior) {
        if (row.lat != null) prior.lat = row.lat;
        if (row.lng != null) prior.lng = row.lng;
        if (row.notes && !prior.notes) prior.notes = row.notes;
        prior.updatedAt = now;
        await put(db, STORE_EQUIPMENT, prior);
      } else {
        await put(db, STORE_EQUIPMENT, {
          id: uid(),
          visitId: visit.id,
          tag: row.tag,
          eqType: row.eqType || "other",
          notes: row.notes,
          locationDesc: row.area,
          lat: row.lat,
          lng: row.lng,
          photos: [],
          createdAt: now,
          updatedAt: now,
        });
      }
      n += 1;
    }
    visit.updatedAt = now;
    await put(db, STORE_VISITS, visit);
    return n;
  } finally {
    db.close();
  }
}
