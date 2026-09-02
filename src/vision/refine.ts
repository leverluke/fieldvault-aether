type Rect = {
  class: string;
  name?: string;
  color?: string;
  kind?: string;
  w: number;
  h: number;
  y: number;
};

/** ImageNet className fragments → a finer label that stays in the COCO family. */
const NET: { test: RegExp; class: string; name: string }[] = [
  { test: /sports car|racer|convertible|coupe/, class: "car", name: "sports car" },
  { test: /minivan|minibus/, class: "car", name: "minivan" },
  { test: /jeep|land rover/, class: "car", name: "SUV" },
  { test: /pickup|pick-up/, class: "truck", name: "pickup" },
  { test: /moving van|tow truck/, class: "truck", name: "truck" },
  { test: /ambulance/, class: "truck", name: "ambulance" },
  { test: /police van|police car/, class: "car", name: "police car" },
  { test: /cab|taxi/, class: "car", name: "taxi" },
  { test: /motor scooter|moped/, class: "motorcycle", name: "scooter" },
  { test: /mountain bike|bicycle-built-for/, class: "bicycle", name: "bicycle" },
  { test: /speedboat/, class: "boat", name: "speedboat" },
  { test: /canoe|kayak/, class: "boat", name: "kayak" },
  { test: /yawl|schooner|catamaran|trimaran/, class: "boat", name: "sailboat" },
  { test: /lifeboat|fireboat/, class: "boat", name: "workboat" },
  { test: /airliner|warplane|airship/, class: "airplane", name: "aircraft" },
  { test: /golden retriever|labrador|husky|chihuahua|pug|beagle|terrier|shepherd|collie|poodle|bulldog|boxer|dalmatian/, class: "dog", name: "dog" },
  { test: /tabby|tiger cat|persian cat|siamese|egyptian cat/, class: "cat", name: "cat" },
  { test: /magpie|jay|chickadee|goldfinch|indigo bunting|robin|goose|drake|cock|hen|ostrich/, class: "bird", name: "bird" },
  { test: /goldfish|tench|barracouta|eel|sturgeon|lionfish|puffer|anemone fish|great white|tiger shark|hammerhead/, class: "fish", name: "fish" },
  { test: /windsor chair|rocking chair|folding chair/, class: "chair", name: "chair" },
  { test: /studio couch|day bed/, class: "couch", name: "couch" },
  { test: /dining table|desk/, class: "dining table", name: "table" },
  { test: /pool table|billiard/, class: "dining table", name: "table" },
  { test: /notebook|laptop/, class: "laptop", name: "laptop" },
  { test: /desktop computer|monitor|screen/, class: "tv", name: "monitor" },
  { test: /cellular telephone|iPod/, class: "cell phone", name: "phone" },
  { test: /remote control/, class: "remote", name: "remote" },
  { test: /water bottle|pop bottle|beer bottle|wine bottle/, class: "bottle", name: "bottle" },
  { test: /coffee mug|cup/, class: "cup", name: "mug" },
  { test: /espresso maker|coffeepot/, class: "cup", name: "mug" },
  { test: /refrigerator/, class: "refrigerator", name: "fridge" },
  { test: /microwave/, class: "microwave", name: "microwave" },
  { test: /toaster/, class: "toaster", name: "toaster" },
  { test: /washer|dishwasher/, class: "sink", name: "appliance" },
  { test: /potted plant|pot/, class: "potted plant", name: "plant" },
  { test: /backpack/, class: "backpack", name: "backpack" },
  { test: /purse|handbag|mailbag/, class: "handbag", name: "bag" },
  { test: /umbrella/, class: "umbrella", name: "umbrella" },
  { test: /suit|tie|bow tie/, class: "tie", name: "tie" },
];

function breed(label: string): string | undefined {
  const m = label.match(
    /\b(golden retriever|labrador retriever|german shepherd|siberian husky|chihuahua|pug|beagle|poodle|french bulldog|boxer|dalmatian|tabby|siamese|persian)\b/i,
  );
  return m ? m[1].toLowerCase() : undefined;
}

export function refineShape(o: Pick<Rect, "class" | "w" | "h" | "y">): string | undefined {
  const ar = o.h / Math.max(0.001, o.w);
  const area = o.w * o.h;
  const c = o.class;

  if (c === "person") {
    if (ar > 2.35 && area < 0.12) return "child";
    if (ar < 1.15) return "seated person";
    if (ar > 2.05) return "standing person";
    return "person";
  }
  if (c === "car") {
    if (ar > 0.85 && area > 0.08) return "SUV";
    if (o.w / Math.max(0.001, o.h) > 2.25) return "sedan";
    if (ar > 0.72) return "hatchback";
    return "car";
  }
  if (c === "truck") {
    if (ar < 0.7 && o.w > 0.35) return "pickup";
    return "truck";
  }
  if (c === "boat") {
    if (ar > 1.35) return "sailboat";
    if (o.w > 0.45 && ar < 0.55) return "workboat";
    return "boat";
  }
  if (c === "chair") {
    if (o.w > o.h * 1.15) return "armchair";
    return "chair";
  }
  if (c === "dining table") {
    if (o.y > 0.45 && o.h < 0.28) return "coffee table";
    return "table";
  }
  if (c === "bottle") {
    if (ar > 2.4) return "bottle";
    return "jar";
  }
  if (c === "cup") return ar > 1.2 ? "mug" : "cup";
  if (c === "tv") return area < 0.08 ? "monitor" : "tv";
  if (c === "cell phone") return ar > 1.8 ? "phone" : "phone";
  if (c === "remote") return "remote";
  if (c === "bird" && area < 0.02) return "bird";
  return undefined;
}

export function refineFromNet(
  className: string,
  cocoClass: string,
): { class: string; name: string } | undefined {
  const q = className.toLowerCase();
  const dog = breed(q);
  if (dog && (cocoClass === "dog" || cocoClass === "cat" || cocoClass === "animal")) {
    return { class: q.includes("cat") ? "cat" : "dog", name: dog };
  }
  for (const row of NET) {
    if (!row.test.test(q)) continue;
    if (row.class === cocoClass || cocoClass === "object" || familyLoose(row.class, cocoClass)) {
      return { class: row.class, name: row.name };
    }
  }
  return undefined;
}

function familyLoose(a: string, b: string) {
  const veh = ["car", "truck", "bus", "motorcycle", "bicycle", "boat", "airplane", "train"];
  if (veh.includes(a) && veh.includes(b)) return true;
  if (a === b) return true;
  return false;
}

export function displayName(o: Pick<Rect, "class" | "name" | "color" | "kind">) {
  const core = o.name || o.kind || o.class;
  return o.color && !core.startsWith(o.color) ? `${o.color} ${core}` : core;
}
