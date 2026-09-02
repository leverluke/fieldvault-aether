export const SCENE = new Set([
  "chair",
  "couch",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "potted plant",
  "backpack",
  "umbrella",
  "handbag",
  "suitcase",
  "bench",
]);

export const ALIASES: Record<string, string> = {
  sofa: "couch",
  settee: "couch",
  television: "tv",
  telly: "tv",
  monitor: "tv",
  screen: "tv",
  phone: "cell phone",
  cellphone: "cell phone",
  mobile: "cell phone",
  table: "dining table",
  desk: "dining table",
  fridge: "refrigerator",
  plant: "potted plant",
  computer: "laptop",
  pc: "laptop",
  clicker: "remote",
  "remote control": "remote",
  mug: "cup",
  glass: "wine glass",
  armchair: "chair",
  seat: "chair",
  pillow: "couch",
  toilet: "toilet",
  bathroom: "toilet",
  microwave: "microwave",
  oven: "oven",
  sink: "sink",
  clock: "clock",
  book: "book",
  bottle: "bottle",
  backpack: "backpack",
  bag: "handbag",
  umbrella: "umbrella",
  keyboard: "keyboard",
  mouse: "mouse",
  toothbrush: "toothbrush",
  bowl: "bowl",
  cup: "cup",
  bed: "bed",
  couch: "couch",
  chair: "chair",
  laptop: "laptop",
  remote: "remote",
  tv: "tv",
  person: "person",
  people: "person",
  human: "person",
  humans: "person",
  man: "person",
  men: "person",
  woman: "person",
  women: "person",
  guy: "person",
  girl: "person",
  child: "person",
  pedestrian: "person",
  someone: "person",
  dog: "dog",
  dogs: "dog",
  puppy: "dog",
  puppies: "dog",
  hound: "dog",
  cat: "cat",
  cats: "cat",
  kitten: "cat",
  bird: "bird",
  birds: "bird",
  horse: "horse",
  horses: "horse",
  cow: "cow",
  cattle: "cow",
  sheep: "sheep",
  fish: "fish",
  car: "car",
  cars: "car",
  coupe: "car",
  sedan: "car",
  hatchback: "car",
  suv: "car",
  jeep: "car",
  minivan: "car",
  taxi: "car",
  van: "car",
  kid: "person",
  seated: "person",
  "standing person": "person",
  kayak: "boat",
  canoe: "boat",
  sailboat: "boat",
  speedboat: "boat",
  yacht: "boat",
  workboat: "boat",
  "coffee table": "dining table",
  jar: "bottle",
  vehicle: "car",
  vehicles: "car",
  truck: "truck",
  trucks: "truck",
  pickup: "truck",
  lorry: "truck",
  bus: "bus",
  buses: "bus",
  motorcycle: "motorcycle",
  motorbike: "motorcycle",
  scooter: "motorcycle",
  bike: "bicycle",
  bicycle: "bicycle",
  bicycles: "bicycle",
};

const COCO = new Set([
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
  "fish",
]);

export function canonicalClass(raw: string): string | undefined {
  const q = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (ALIASES[q]) return ALIASES[q];
  if (COCO.has(q)) return q;
  for (const [k, v] of Object.entries(ALIASES)) {
    if (q.includes(k)) return v;
  }
  for (const c of COCO) {
    if (q.includes(c)) return c;
  }
  return undefined;
}

export function parseSeek(q: string): string | undefined {
  const m = q.match(
    /\b(?:find|where(?:'?s| is)?|look for|search for|see the|get the|bring me|point (?:at|to)|go to|lock (?:on|onto)|track the|follow (?:the |that )?)\s+(?:the |a |an |my |that |this )?([a-z][a-z ]{1,24})/,
  );
  if (m) return canonicalClass(m[1].replace(/\bplease\b/g, "").trim());
  return undefined;
}

export function parseWatch(q: string): string[] | undefined {
  if (/\b(track|watch|see|show)\s+(everything|anything|all)\b/.test(q) && !/\bexcept\b/.test(q)) {
    return [];
  }
  const m = q.match(
    /\b(?:only|just|exclusively)\s+(?:track |watch |see |look for |search |follow )?(?:for )?(.+?)(?:\.|$)/,
  ) || q.match(/\b(?:track|watch|follow)\s+(?:only |just )?(?:for )?(.+?)(?:\.|$)/);
  if (!m) return undefined;
  const parts = m[1]
    .replace(/\b(please|the|a|an|my|those|these)\b/g, " ")
    .split(/\s*(?:,| and | or |\/)\s*/);
  const out = parts.map((p) => canonicalClass(p.trim())).filter((c): c is string => Boolean(c));
  return out.length ? [...new Set(out)] : undefined;
}

export function family(c: string): string {
  if (c === "person") return "people";
  if (["car", "truck", "bus", "motorcycle", "bicycle", "boat", "airplane", "train"].includes(c)) return "vehicle";
  if (c === "fish" || c.startsWith("aquatic:") || c.startsWith("fish:")) return "fish";
  if (["dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"].includes(c))
    return "animal";
  if (SCENE.has(c)) return "scene";
  return c;
}

export function kin(a: string, b: string) {
  if (a === b) return true;
  return family(a) === family(b);
}
