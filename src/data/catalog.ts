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
    dek: "Snap the unit. Pin it on the map. Leave with one package the office can send.",
    status: "Live prototype",
    hero: "The live walk is Open walkdown. Widgets on this page are samples — a stranger starts at /play: Create First Visit, Snap, optional sheet pin, Leave or For drawings.",
    summary:
      "FieldVault is the walkdown tool. Open walkdown for a real visit. Guided shots, area-level GPS (FixPlot — not a sheet pin unless you place one), completeness scoring (WalkScore), and a named export live in /play — not these brochure widgets.",
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
        caption: "Area-level GPS. Nearby tags cluster into plant areas — not a drawing pin unless you place one.",
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
        body: "Last-known fix is area-level unless you pin a sheet. Nearby points become a suggested plant area.",
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
    kicker: "Operator",
    dek: "On-device memory, skill drafts, confirm-to-fulfill. Eyes and Craft stay the body — Aether is the brain next to them.",
    status: "Live prototype",
    hero: "Personal operator loop: talk → memory → plan → skill draft → Levi confirm → receipt or honest gap. No accounts.",
    summary:
      "Aether remembers Levi on-device, drafts plan/food/parts/project cards, and only acts on confirm phrases. Eyes run YOLOv8n + COCO in the tab. Craft is a simulated hull — not MAVLink. Food still hands you Call or a maps/search handoff; it does not sit on the restaurant line.",
    heroImage: "/media/aether-hero.jpg",
    playHref: "/apps/aether",
    views: [
      {
        id: "operator",
        label: "Operator",
        caption: "Memory panel, open loops, draft cards. Say order it / do it after you approve.",
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
        id: "life",
        label: "Life",
        caption: "Draft food/call scripts. Confirm phrases open the best handoff — no fake order ids.",
        image: "/media/aether-hero.jpg",
      },
    ],
    features: [
      {
        title: "Operator",
        body: "Memory kinds, skill cards (plan/food/parts/project), confirm-to-fulfill with receipts or named gaps.",
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
        body: "Draft the table, clipboard + maps/search handoff, tel: or Twilio. You approve spend/send/call.",
      },
    ],
    cta: { label: "Open operator", href: "/apps/aether" },
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
