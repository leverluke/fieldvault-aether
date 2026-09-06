import { walkGapText } from "./format.js";
import { qrDataUrl, qrSvg } from "./qr";

export type HandoffPin = {
  tag?: string;
  lat?: number | null;
  lng?: number | null;
  photos?: unknown[];
  notes?: string;
  needsFollowup?: boolean;
};

export function compactHandoff(
  visit: { title?: string; client?: string; facility?: string; date?: string },
  items: HandoffPin[],
) {
  const pins = (items || []).slice(0, 8).map((e) => ({
    t: String(e.tag || "?").slice(0, 16),
    n: (e.photos || []).length,
    la: e.lat != null ? Number(Number(e.lat).toFixed(5)) : null,
    ln: e.lng != null ? Number(Number(e.lng).toFixed(5)) : null,
  }));
  return {
    fv: 1,
    title: String(visit?.title || "Visit").slice(0, 40),
    site: [visit?.client, visit?.facility].filter(Boolean).join(" · ").slice(0, 40),
    date: visit?.date || "",
    count: (items || []).length,
    pins,
  };
}

export function handoffLine(
  visit: { title?: string; client?: string; facility?: string },
  items: HandoffPin[],
) {
  const pack = compactHandoff(visit, items);
  const first = pack.pins
    .filter((p) => p.la != null)
    .slice(0, 4)
    .map((p) => p.t + " " + p.la + "," + p.ln)
    .join(" | ");
  return ("FV|" + pack.title + "|" + pack.count + " pins|" + first).slice(0, 100);
}

export function handoffHtml(
  visit: { title?: string; client?: string; facility?: string; date?: string; overallNotes?: string },
  items: Array<HandoffPin & { eqType?: string; locationDesc?: string }>,
  gapText = "",
) {
  const rows = (items || [])
    .map((e) => {
      const gps = e.lat != null && e.lng != null ? Number(e.lat).toFixed(5) + ", " + Number(e.lng).toFixed(5) : "—";
      return `<tr><td>${escape(e.tag || "")}</td><td>${(e.photos || []).length}</td><td>${gps}</td><td>${escape(e.notes || e.locationDesc || "")}</td></tr>`;
    })
    .join("");
  const qr = qrSvg(handoffLine(visit, items), 5);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(visit.title || "FieldVault")}</title>
<style>
body{font:16px/1.45 system-ui,sans-serif;margin:0;background:#0c0f12;color:#eef2f5}
main{max-width:720px;margin:0 auto;padding:20px}
h1{font-size:1.4rem;margin:0 0 6px}
.meta{color:#9aa7b0}
table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{border-bottom:1px solid #2a333b;padding:8px 6px;text-align:left}
.qr{background:#fff;padding:10px;display:inline-block;margin:16px 0}
</style></head><body><main>
<p class="meta">FieldVault truck handoff</p>
<h1>${escape(visit.title || "Visit")}</h1>
<p class="meta">${escape([visit.client, visit.facility, visit.date].filter(Boolean).join(" · "))}</p>
${gapText ? `<p><strong>Next:</strong> ${escape(gapText)}</p>` : ""}
${visit.overallNotes ? `<p>${escape(visit.overallNotes)}</p>` : ""}
<div class="qr">${qr}</div>
<table><thead><tr><th>Tag</th><th>Photos</th><th>GPS</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
<p class="meta">Photos travel in the ZIP next to this file. No account required.</p>
</main></body></html>`;
}

export function handoffQrUrl(
  visit: { title?: string; client?: string; facility?: string },
  items: HandoffPin[],
) {
  return qrDataUrl(handoffLine(visit, items));
}

function escape(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { walkGapText };
