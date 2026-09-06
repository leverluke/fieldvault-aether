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
