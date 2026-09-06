export type DemoId = "capture" | "gps" | "export" | "space";

export type View = {
  id: string;
  label: string;
  caption: string;
  image: string;
  demo?: DemoId;
};

export type Feature = {
  title: string;
  body: string;
};

export type WorkItem = {
  slug: string;
  title: string;
  titleLines: [string, string?];
  kicker: string;
  dek: string;
  status: string;
  hero: string;
  summary: string;
  heroImage: string;
  views: View[];
  features: Feature[];
  cta: { label: string; href: string };
  playHref?: string;
};

export const WORK: WorkItem[] = [
  {
    slug: "fieldvault",
    title: "FieldVault",
    titleLines: ["Field", "Vault"],
    kicker: "Site capture",
    dek: "Photograph the unit in a guided sequence, pin it to GPS, score the walk, and leave with a package the office can use.",
    status: "Live prototype",
    hero: "A phone-first notebook for facility documentation. FixPlot, WalkScore, and the deliverable pipeline live inside this preview — they are views of the same product.",
    summary:
      "FieldVault is the walkdown tool. Guided shots, last-known GPS (FixPlot), completeness scoring (WalkScore), and a named export are all here — not separate apps.",
    heroImage: "/media/fieldvault-ui.png",
    views: [
      {
        id: "capture",
        label: "Guided capture",
        caption: "WalkScore lives in the shot list. Check off a pump and watch the visit go leave-ready.",
        image: "/media/fieldvault-ui.png",
        demo: "capture",
      },
      {
        id: "fixplot",
        label: "FixPlot",
        caption: "Drop noisy GPS the way a walk actually happens. Nearby tags cluster into plant areas.",
        image: "/media/fieldvault-gps-ui.png",
        demo: "gps",
      },
      {
        id: "export",
        label: "Deliverable",
        caption: "Tags, areas, and files named on purpose — not a camera roll.",
        image: "/media/fieldvault-export-ui.png",
        demo: "export",
      },
      {
        id: "tag",
        label: "Nameplate",
        caption: "The shot that matters later. Type-specific sequences so a junior still gets the plate.",
        image: "/media/fieldvault-ui.png",
        demo: "capture",
      },
    ],
    features: [
      {
        title: "Guided sequences",
        body: "Pumps, vessels, exchangers, valves. Wide, nameplate, then the details.",
      },
      {
        title: "FixPlot GPS",
        body: "Last-known fix on the equipment. Nearby points become a suggested area.",
      },
      {
        title: "WalkScore",
        body: "Weighted shots. Below the line, you stay on the unit.",
      },
      {
        title: "Offline capture",
        body: "IndexedDB blobs, HEIC + EXIF, nameplate OCR, a phone that still works when the radio dies.",
      },
    ],
    cta: { label: "Open walkdown", href: "/apps/fieldvault/play" },
    playHref: "/apps/fieldvault/play",
  },
  {
    slug: "aether",
    title: "Aether",
    titleLines: ["Aether"],
    kicker: "Cortex",
    dek: "Fourteen subagents behind one voice. Close calls run together. Drafts the table, sees the room, steers a hull in the tab. You still talk to the host.",
    status: "Live prototype",
    hero: "A cortex, not a chat window. 14 specialists: life, comms, nav, eyes, map, safety, craft, memory, watch, time, weather, export, brief, help.",
    summary:
      "Aether books a draft and hands you Call. Eyes run YOLOv8n + COCO, ByteTrack IDs, MoveNet stance, and a 2D SLAM sketch in the tab. Craft yaws toward a lock and holds when the path is blocked. Chart pack / zip / GeoJSON leave with the run. It is not a real vehicle, not a named face, and not the restaurant host.",
    heroImage: "/media/aether-hero.jpg",
    playHref: "/apps/aether/craft",
    views: [
      {
        id: "console",
        label: "Life",
        caption: "Book Saturday 7. Call them. Remind me in 20 minutes. Yes to dial.",
        image: "/media/aether-hero.jpg",
      },
      {
        id: "eyes",
        label: "Eyes",
        caption: "Boxes are classes + IDs. LOCK is a stable track. Ask what it sees.",
        image: "/media/lookout-preview.png",
      },
      {
        id: "craft",
        label: "Craft",
        caption: "Air, water, or ground. Same eyes. Autopilot holds on a blocked path.",
        image: "/media/lookout-preview.png",
      },
      {
        id: "cortex",
        label: "Cortex",
        caption: "14 subagents. Close scores run as a panel. Status includes what the eyes last saw.",
        image: "/media/aether-hero.jpg",
      },
    ],
    features: [
      {
        title: "Cortex",
        body: "14 subagents. Close scores run as a panel (brief + eyes). Optional Grok key for fuzzy tool-calling.",
      },
      {
        title: "Eyes",
        body: "YOLOv8n + COCO, ByteTrack, Kalman, MoveNet, OCR stencil, SLAM sketch. JSON a hull can ingest.",
      },
      {
        title: "Craft",
        body: "Air, water, or ground. Seek, orbit, go home. Phone is the camera. Not a radio link.",
      },
      {
        title: "Life",
        body: "Draft the table, .ics, Gmail compose, tel: or Twilio. You talk to the host.",
      },
    ],
    cta: { label: "Open eyes", href: "/apps/aether/see" },
  },
];

export const SOON = [
  {
    title: "Hull link",
    body: "The JSON is ready. Next is MAVLink / NMEA into a real airframe, boat, or rover — not a second brain.",
    eta: "Next",
  },
  {
    title: "Open-vocab eyes",
    body: "YOLO-World or a custom class head in the same tracker. “Find the red valve” without a COCO name.",
    eta: "Weights",
  },
];

export const ALIASES: Record<string, string> = {
  lookout: "aether",
  fixplot: "fieldvault",
  walkscore: "fieldvault",
  "capture-architecture": "fieldvault",
  "guided-sequences": "fieldvault",
  "deliverable-pipeline": "fieldvault",
};

export function bySlug(slug: string) {
  const mapped = ALIASES[slug] ?? slug;
  return WORK.find((w) => w.slug === mapped);
}
