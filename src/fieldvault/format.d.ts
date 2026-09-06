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
