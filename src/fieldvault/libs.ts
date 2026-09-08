/**
 * Browser adapter for FieldVault Map / ZIP / PDF.
 * Loaded only from the play route (or initFieldVault) so SSR never hits `window`.
 */
import type { jsPDF } from "jspdf";
import type JSZip from "jszip";

type LeafletNS = typeof import("leaflet");

export type ZipCtor = new () => JSZip;

type FieldVaultLibs = {
  L: LeafletNS;
  JSZip: ZipCtor;
  jspdf: { jsPDF: typeof jsPDF };
};

function asLeaflet(mod: unknown): LeafletNS {
  if (mod && typeof mod === "object" && "map" in mod && typeof (mod as { map: unknown }).map === "function") {
    return mod as LeafletNS;
  }
  if (mod && typeof mod === "object" && "default" in mod) {
    return asLeaflet((mod as { default: unknown }).default);
  }
  throw new Error("leaflet module has no L.map");
}

let loaded: FieldVaultLibs | null = null;

export async function ensureFieldVaultLibs(): Promise<FieldVaultLibs | null> {
  if (typeof window === "undefined") return null;
  if (loaded) return loaded;

  const [{ jsPDF }, JSZip, leafletMod] = await Promise.all([
    import("jspdf"),
    import("jszip"),
    import("leaflet"),
  ]);
  await import("leaflet/dist/leaflet.css");
  const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
  const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
  const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;

  const leaflet = asLeaflet(leafletMod);
  leaflet.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  const zip = ((JSZip as { default?: ZipCtor }).default ?? JSZip) as unknown as ZipCtor;
  loaded = { L: leaflet, JSZip: zip, jspdf: { jsPDF } };
  window.L = leaflet;
  window.JSZip = zip;
  window.jspdf = { jsPDF };
  return loaded;
}

declare global {
  interface Window extends Partial<FieldVaultLibs> {}
}
