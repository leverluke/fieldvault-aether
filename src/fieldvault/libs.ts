import L from "leaflet";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

type LeafletWithDefaultIcon = typeof L & {
  Icon: typeof L.Icon & {
    Default: typeof L.Icon.Default & {
      prototype: { _getIconUrl?: unknown };
    };
  };
};

const Leaflet = L as LeafletWithDefaultIcon;
delete Leaflet.Icon.Default.prototype._getIconUrl;
Leaflet.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

declare global {
  interface Window {
    L: typeof L;
    jspdf: { jsPDF: typeof jsPDF };
    JSZip: typeof JSZip;
  }
}

export function loadFieldVaultLibs() {
  window.L = L;
  window.jspdf = { jsPDF };
  window.JSZip = JSZip;
}
