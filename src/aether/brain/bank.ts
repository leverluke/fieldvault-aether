export type AgentId =
  | "eyes"
  | "craft"
  | "life"
  | "comms"
  | "nav"
  | "memory"
  | "time"
  | "weather"
  | "brief"
  | "export"
  | "safety"
  | "map"
  | "watch"
  | "help";

export const BANK: { agent: AgentId; phrases: string[] }[] = [
  {
    agent: "eyes",
    phrases: [
      "what do you see",
      "what's in the frame",
      "describe the room",
      "find the chair",
      "where is the remote",
      "how many people",
      "look for the dog",
      "search for the blue car",
      "point at the tv",
      "what is that",
      "open your eyes",
      "start the camera",
    ],
  },
  {
    agent: "craft",
    phrases: [
      "take off",
      "land",
      "hold",
      "follow number one",
      "go home",
      "orbit",
      "cast off",
      "dock",
      "roll out",
      "park",
      "autopilot",
      "follow me",
      "join mesh",
    ],
  },
  {
    agent: "life",
    phrases: [
      "book a table saturday at seven",
      "reserve the italian place",
      "table for four tonight",
      "cancel that reservation",
    ],
  },
  {
    agent: "comms",
    phrases: ["call them", "text them", "email the restaurant", "dial this number"],
  },
  {
    agent: "nav",
    phrases: ["directions there", "nearby coffee", "how far to the airport", "maps to that place"],
  },
  {
    agent: "memory",
    phrases: [
      "add milk to the list",
      "what's on my list",
      "what's next",
      "note that",
      "remember the gate code is 1234",
      "call that pump four",
      "what do you remember",
    ],
  },
  {
    agent: "watch",
    phrases: ["tell me when you see a dog", "watch for people", "what are you watching", "stop watching"],
  },
  {
    agent: "time",
    phrases: [
      "what time is it",
      "remind me in twenty minutes",
      "set a timer for five minutes",
      "time in tokyo",
    ],
  },
  {
    agent: "weather",
    phrases: ["weather", "forecast", "temperature outside", "sunrise"],
  },
  {
    agent: "brief",
    phrases: ["status", "briefing", "good morning", "what's the situation", "daily report"],
  },
  {
    agent: "export",
    phrases: ["export zip", "export coco", "chart pack", "fieldvault row", "export geojson"],
  },
  {
    agent: "safety",
    phrases: ["anyone down", "path blocked", "path clear", "fallen", "failsafe"],
  },
  {
    agent: "map",
    phrases: [
      "what's on the map",
      "what have you seen",
      "heading",
      "tour the sketch",
      "set home",
      "drop waypoint",
      "where am i",
    ],
  },
  {
    agent: "help",
    phrases: ["help", "what can you do", "commands", "capabilities"],
  },
];
