export type Hull = "air" | "water" | "ground";

const KEY = "aether-hull";

export type HullCopy = {
  id: Hull;
  label: string;
  body: string;
  go: string;
  stop: string;
  hold: string;
  going: string;
  stopping: string;
  idle: string;
  ready: string;
  arm: string;
  cut: string;
  usesAlt: boolean;
  cruiseAlt: number;
};

export const HULL: Record<Hull, HullCopy> = {
  air: {
    id: "air",
    label: "Air",
    body: "airframe",
    go: "Take off",
    stop: "Land",
    hold: "Hold",
    going: "Taking off",
    stopping: "Landing",
    idle: "On the pad",
    ready: "Arm the camera, then take off.",
    arm: "Arm camera",
    cut: "Cut camera",
    usesAlt: true,
    cruiseAlt: 12,
  },
  water: {
    id: "water",
    label: "Water",
    body: "hull",
    go: "Cast off",
    stop: "Dock",
    hold: "Hold",
    going: "Casting off",
    stopping: "Docking",
    idle: "At the dock",
    ready: "Arm the camera, then cast off. Autopilot follows open water and holds for hazards.",
    arm: "Arm camera",
    cut: "Cut camera",
    usesAlt: false,
    cruiseAlt: 0,
  },
  ground: {
    id: "ground",
    label: "Ground",
    body: "chassis",
    go: "Roll out",
    stop: "Park",
    hold: "Hold",
    going: "Rolling out",
    stopping: "Parking",
    idle: "Parked",
    ready: "Arm the camera, then roll out.",
    arm: "Arm camera",
    cut: "Cut camera",
    usesAlt: false,
    cruiseAlt: 0,
  },
};

export function loadHull(): Hull {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "air" || v === "water" || v === "ground") return v;
  } catch {
    /* */
  }
  return "air";
}

export function saveHull(h: Hull) {
  try {
    localStorage.setItem(KEY, h);
  } catch {
    /* */
  }
}

export function hullCopy(h: Hull = loadHull()) {
  return HULL[h];
}
