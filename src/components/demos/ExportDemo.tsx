const FILES = [
  "FieldVault_Crude_unit_walkdown.zip",
  "  visit.json",
  "  equipment.csv",
  "  photos/Pump_alley/P-101/P-101_overall_1.jpg",
  "  photos/Pump_alley/P-101/P-101_tag_2.jpg",
];

export function ExportDemo() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        Deliverable shape
      </p>
      <h3 className="mt-1 font-display text-2xl text-fg">What the office gets</h3>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-elevated p-4 font-mono text-xs leading-6 text-fg">
        {FILES.join("\n")}
      </pre>
    </div>
  );
}
