export function csvCell(value: unknown): string;
export function csvRow(cells: unknown[]): string;
export function clusterByAccuracy<T extends { id: string; lat?: number | null; lng?: number | null; gpsAcc?: number }>(
  items: T[],
  baseRadiusM?: number,
): T[][];
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number;
export function walkEvents(items: unknown[]): Array<{
  t: number;
  kind: string;
  eq: Record<string, unknown>;
  photo?: Record<string, unknown>;
  lat?: number;
  lng?: number;
}>;
export function walkLine(items: unknown[]): Array<{ lat: number; lng: number; t: number; eq: Record<string, unknown> }>;
export function walkGeoJson(
  visit: unknown,
  items: unknown[],
  areas: unknown[],
): { type: "FeatureCollection"; features: unknown[] };
export const WEAK_GPS_M: number;
export function roundHeading(deg: unknown): number | null;
export function photoHeading(photo?: { heading?: number } | null, eq?: { heading?: number } | null): number | null;
export function photoGpsAcc(photo?: { gpsAcc?: number } | null, eq?: { gpsAcc?: number } | null): number | null;
export function bestGpsAccuracyM(eq: { gpsAcc?: number; photos?: Array<{ gpsAcc?: number }> } | null | undefined): number | null;
export function hasWeakGps(eq: { lat?: number | null; lng?: number | null; gpsAcc?: number; photos?: Array<{ gpsAcc?: number }> } | null | undefined, threshold?: number): boolean;
export function sheetLocation(
  eq?: { sheet?: { sheet?: string; name?: string; grid?: string; x?: number; y?: number; drawingId?: string } | null; pid?: string } | null,
  photo?: { sheet?: { sheet?: string; name?: string; grid?: string; x?: number; y?: number; drawingId?: string } | null } | null,
): { sheet: string; grid: string; planX: number | ""; planY: number | ""; drawingId: string };
export const EQUIPMENT_CSV_HEADER: string[];
export const PHOTO_INDEX_HEADER: string[];
export function equipmentCsvRow(eq: unknown, photo?: unknown, extras?: { area?: string; readiness?: unknown; photoFile?: string }): unknown[];
export function equipmentCsv(
  items: unknown[],
  areas?: unknown[],
  fileForPhoto?: (eq: unknown, photo: unknown, index: number) => string,
): string;
export function photoIndexCsv(
  items: unknown[],
  areas?: unknown[],
  fileForPhoto?: (eq: unknown, photo: unknown, index: number) => string,
): string;
export function placeOnSheetNote(): string;
export const LEAVE_SITE_SOFT_REASONS: Set<string>;
export function leaveSiteBlockers<T>(items: T[]): T[];
export function punchItems<T>(items: T[]): T[];
export function nearestByGps<T extends { lat?: number | null; lng?: number | null; gpsAcc?: number }>(
  items: T[],
  lat: number,
  lng: number,
  maxM?: number,
): { eq: T; dist: number } | null;
export function isUntitledTag(tag: string): boolean;
export const ATTACH_BASE_M: number;
export const SPLIT_MOVE_M: number;
export const SPLIT_WAIT_MS: number;
export function attachRadiusM(acc?: number, base?: number): number;
export function splitDistanceM(acc?: number): number;
export function pinNumber(tag: string): number | null;
export function compareTags(a: string, b: string): number;
export function firstCaptureAt(eq: { photos?: Array<{ capturedAt?: number }>; createdAt?: number; updatedAt?: number }): number;
export function compareEquipmentWalkOrder(a: unknown, b: unknown): number;
export function hasDarkPhoto(eq: { photos?: Array<{ note?: string }> }): boolean;
export function officePassReasons(eq: unknown): Array<{ id: string; label: string }>;
export function officePassItems<T>(items: T[]): T[];
export function isAreaDay1Done(area: { day1Done?: boolean } | null | undefined): boolean;
export function coverageByArea<A, T>(
  areas: A[] | null | undefined,
  items?: T[] | null,
): {
  used: boolean;
  day1Done: A[];
  day2Remaining: A[];
  punchOpen: T[];
};
export function coverageSummary(plan: {
  used?: boolean;
  day1Done?: unknown[];
  day2Remaining?: unknown[];
  punchOpen?: unknown[];
} | null | undefined): string;
export function rushShotType(photos: unknown[], pending?: string | null): string | null;
export function suggestAttachTarget(opts: {
  items?: unknown[];
  lat?: number | null;
  lng?: number | null;
  acc?: number;
  forceNew?: boolean;
  lastPin?: { id?: string; lat?: number | null; lng?: number | null; tag?: string; photos?: unknown[] } | null;
  lastShotAt?: number | null;
  now?: number;
  lockCurrent?: boolean;
}): { how: "pin" | "current" | "near"; reason: string; eq?: unknown; dist?: number | null; moved?: number };
export function attachPreviewText(suggestion: unknown): string;
export function facilityKey(visit: { client?: string; facility?: string }): string;
export function uniqueFacilities(visits: Array<{ client?: string; facility?: string }>): Array<{
  client: string;
  facility: string;
}>;
export function parseNameplateText(raw: string): {
  text?: string;
  tag?: string;
  serial?: string;
  model?: string;
  hint?: string;
};
export function mapImportRow(row: unknown): {
  tag: string;
  notes: string;
  area: string;
  eqType: string;
  lat: number | null;
  lng: number | null;
  source: string;
};
export function parseSpokenTag(raw: string): string;
export function parseSpokenName(raw: string): string;
export function nextWalkGap<T>(
  items: T[],
  lat?: number | null,
  lng?: number | null,
): { eq: T; dist: number | null; reason: { id: string; label: string } | null } | null;
export function walkGapText(gap: { eq?: { tag?: string }; dist?: number | null; reason?: { label?: string } | null } | null): string;
export function hammingHex(a: string, b: string): number;
export function dHashFromGray(gray: number[], size?: number): string;
export function isBlurryVar(laplacianVar: number, threshold?: number): boolean;
export function hasNoteFlag(eq: { photos?: Array<{ note?: string }> }, re: RegExp): boolean;
