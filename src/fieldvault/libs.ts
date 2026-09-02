/**
 * Thin browser adapter for FieldVault Map / Export Package / Generate Report.
 * Import before initFieldVault() (app.js does this). Play route may also import it.
 */
import L from "leaflet";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type FieldVaultLibs = {
  L: typeof L;
  JSZip: typeof JSZip;
  jspdf: { jsPDF: typeof jsPDF };
};

const g = globalThis as typeof globalThis & FieldVaultLibs;

g.L = L;
g.JSZip = JSZip;
g.jspdf = { jsPDF };

if (typeof window !== "undefined") {
  window.L = L;
  window.JSZip = JSZip;
  window.jspdf = { jsPDF };
}

export { L, JSZip };

declare global {
  interface Window extends FieldVaultLibs {}
}
