export function icsEvent(opts: { title: string; when?: number; minutes?: number; where?: string; body?: string }) {
  const start = opts.when ? new Date(opts.when) : new Date(Date.now() + 3600000);
  const end = new Date(start.getTime() + (opts.minutes || 90) * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aether//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@aether`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${(opts.title || "Aether").replace(/\n/g, " ")}`,
    opts.where ? `LOCATION:${opts.where.replace(/\n/g, " ")}` : "",
    opts.body ? `DESCRIPTION:${opts.body.replace(/\n/g, "\\n")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "aether.ics";
  a.click();
  return ics;
}

export function gcalUrl(opts: { title: string; when?: number; minutes?: number; where?: string; body?: string }) {
  const start = opts.when ? new Date(opts.when) : new Date(Date.now() + 3600000);
  const end = new Date(start.getTime() + (opts.minutes || 90) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (opts.where) q.set("location", opts.where);
  if (opts.body) q.set("details", opts.body);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function gmailDraft(to: string, subject: string, body: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
