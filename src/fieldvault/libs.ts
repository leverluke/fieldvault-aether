/**
 * Thin browser adapter for FieldVault Map / Export Package / Generate Report.
 * Import before initFieldVault() (app.js does this). Play route may also import it.
 *
 * Leaflet is loaded dynamically so SSR never evaluates `window`.
 */
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

type LeafletNS = typeof import("leaflet");

function asLeaflet(mod: unknown): LeafletNS {
  if (mod && typeof mod === "object" && "map" in mod && typeof (mod as { map: unknown }).map === "function") {
    return mod as LeafletNS;
  }
  if (mod && typeof mod === "object" && "default" in mod) {
    return asLeaflet((mod as { default: unknown }).default);
  }
  throw new Error("leaflet module has no L.map");
}

function install(leaflet: LeafletNS) {
  leaflet.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  const g = globalThis as typeof globalThis & FieldVaultLibs;
  g.L = leaflet;
  g.JSZip = JSZip;
  g.jspdf = { jsPDF };
  if (typeof window !== "undefined") {
    window.L = leaflet;
    window.JSZip = JSZip;
    window.jspdf = { jsPDF };
  }
}

type FieldVaultLibs = {
  L: LeafletNS;
  JSZip: typeof JSZip;
  jspdf: { jsPDF: typeof jsPDF };
};

export let L: LeafletNS;
export { JSZip };

export async function ensureFieldVaultLibs() {
  if (typeof window === "undefined") return;
  if (L) return;
  const leaflet = asLeaflet(await import("leaflet"));
  L = leaflet;
  install(leaflet);
}

if (typeof window !== "undefined") {
  await ensureFieldVaultLibs();
}

declare global {
  interface Window extends FieldVaultLibs {}
}
