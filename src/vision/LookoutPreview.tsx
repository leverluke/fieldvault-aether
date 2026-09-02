export function LookoutPreview() {
  const boxes = [
    { label: "#4 chair LOCK", x: "18%", y: "42%", w: "22%", h: "38%" },
    { label: "#2 monitor", x: "48%", y: "22%", w: "28%", h: "24%" },
    { label: "#7 remote", x: "58%", y: "68%", w: "12%", h: "10%" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="relative aspect-video bg-[#141416]">
        {boxes.map((b) => (
          <div
            key={b.label}
            className="absolute border border-primary"
            style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
          >
            <span className="absolute -top-5 left-0 bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
              {b.label}
            </span>
          </div>
        ))}
        <p className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-wider text-muted">
          Path clear · 3 IDs · SLAM sketch
        </p>
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="font-mono text-xs text-muted">
          {`{ "block": false, "objects": ["chair","tv","remote"], "backend": "yolo+coco" }`}
        </p>
      </div>
    </div>
  );
}