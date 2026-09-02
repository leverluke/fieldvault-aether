import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/apps/aether/verify")({
  component: Verify,
});

async function sha(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Verify() {
  const [msg, setMsg] = useState("Drop hash.txt or the zip. I'll hash the file in this tab.");
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Deliverable</p>
      <h1 className="mt-2 font-display text-3xl text-fg">Verify pack</h1>
      <p className="mt-3 text-sm text-muted">
        Hash the file you pick. If it's a zip, I also read hash.txt inside and compare.
      </p>
      <input
        type="file"
        className="mt-6 block w-full text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void (async () => {
            const buf = await f.arrayBuffer();
            const fileHash = await sha(buf);
            const last = (localStorage.getItem("aether:last-hash") || "").toLowerCase();
            let inner = "";
            if (f.name.endsWith(".zip")) {
              try {
                const JSZip = (await import("jszip")).default;
                const zip = await JSZip.loadAsync(buf);
                inner = ((await zip.file("hash.txt")?.async("string")) || "").trim().toLowerCase();
              } catch {
                inner = "";
              }
            }
            const bits = [`File SHA-256 ${fileHash.slice(0, 16)}…`];
            if (inner) bits.push(inner.slice(0, 16) === fileHash.slice(0, 16) || last.includes(inner.slice(0, 16)) ? `hash.txt matches last export.` : `hash.txt ${inner.slice(0, 16)}…`);
            if (last) bits.push(last.includes(fileHash.slice(0, 16)) || (inner && last.includes(inner.slice(0, 16))) ? "Matches this browser's last zip." : "Does not match last local export.");
            setMsg(bits.join(" "));
          })();
        }}
      />
      <p className="mt-4 text-sm text-fg">{msg}</p>
    </div>
  );
}