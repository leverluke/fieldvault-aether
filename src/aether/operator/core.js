/**
 * Aether operator loop — pure logic (no DOM). Browser store wraps LocalStorage.
 * Draft → Levi confirm → fulfill as far as this stack can go. Never fake receipts.
 */

/** @typedef {"fact"|"preference"|"project"|"open_loop"|"lesson"|"receipt"} MemoryKind */
/** @typedef {"plan"|"food"|"parts"|"project"|"craft"} SkillKind */
/** @typedef {"food"|"parts"|"call"|"message"|"web"} FulfillKind */
/** @typedef {"draft"|"needs_connector"|"running"|"done"|"failed"} FulfillStatus */
/** @typedef {"draft"|"confirmed"|"rejected"|"executing"|"fulfilled"|"failed"|"needs_connector"} CardStatus */

/**
 * @typedef {object} MemoryEntry
 * @property {string} id
 * @property {MemoryKind} kind
 * @property {string} text
 * @property {Record<string, string>=} meta
 * @property {number} at
 * @property {boolean=} forgotten
 */

/**
 * @typedef {object} Fulfillment
 * @property {string} id
 * @property {FulfillKind} kind
 * @property {FulfillStatus} status
 * @property {string} whatLeviSaid
 * @property {string=} receipt
 * @property {string=} failReason
 */

/**
 * @typedef {object} DraftArtifact
 * @property {string=} who
 * @property {string} what
 * @property {string=} when
 * @property {string=} message
 * @property {string=} url
 * @property {string=} tel
 * @property {string=} mailto
 * @property {string=} copy
 * @property {string=} maps
 */

/**
 * @typedef {object} DraftCard
 * @property {string} id
 * @property {SkillKind} skill
 * @property {string} title
 * @property {string[]} plan
 * @property {DraftArtifact} draft
 * @property {CardStatus} status
 * @property {string} source
 * @property {number} at
 * @property {Fulfillment=} fulfillment
 * @property {string=} projectId
 */

/**
 * @typedef {object} ProjectAttach
 * @property {string} id
 * @property {string} label
 * @property {string} goal
 * @property {string[]} constraints
 * @property {string[]} paths
 * @property {string[]} nextMoves
 * @property {string[]} blockers
 * @property {number} attachedAt
 */

/**
 * @typedef {object} OperatorState
 * @property {MemoryEntry[]} memories
 * @property {DraftCard[]} cards
 * @property {ProjectAttach[]} projects
 * @property {string|null} activeCardId
 * @property {string|null} activeProjectId
 */

/**
 * @typedef {object} Kv
 * @property {(k: string) => string|null} get
 * @property {(k: string, v: string) => void} set
 * @property {(k: string) => void} remove
 */

export const STORAGE_KEY = "aether:operator";

export const CONFIRM_PHRASES =
  /\b(order this|order it|buy this|buy it|send it|call them|do it|go)\b/i;

/** Existing in-repo paths only — no invented files. */
export const PROJECT_MAPS = {
  fieldvault: {
    id: "fieldvault",
    label: "FieldVault",
    goal: "Walkdown demo works without Levi narrating.",
    constraints: [
      "Do not rewrite FieldVault.",
      "Do not touch rush loop, login/Accounts, CRM, or Defense on the first screen.",
      "IndexedDB stays on-device.",
    ],
    paths: [
      "src/fieldvault/app.js",
      "src/fieldvault/format.js",
      "src/fieldvault/bridge.ts",
      "src/routes/apps/fieldvault/play.tsx",
    ],
    nextMoves: [
      "Read play route boot + leave-site pack path.",
      "Name the next gap that still needs Levi to narrate.",
      "Propose one code-shaped fix inside src/fieldvault — do not rewrite the module.",
    ],
    blockers: ["Levi must confirm any change that touches the first screen."],
  },
  eyes: {
    id: "eyes",
    label: "Aether Eyes",
    goal: "In-tab detect + teach stays honest (COCO/YOLO, not LiDAR).",
    constraints: [
      "Eyes = browser COCO/YOLO, not LiDAR.",
      "Reuse LocalStorage teach bank / graves.",
    ],
    paths: [
      "src/vision/Lookout.tsx",
      "src/vision/detector.ts",
      "src/vision/yolo.ts",
      "src/vision/tracker.ts",
      "src/routes/apps/aether/see.tsx",
    ],
    nextMoves: [
      "Open /apps/aether/see and confirm model load path.",
      "Check teach bank persistence after refresh.",
      "Propose one detector/UX step — no open-vocab claim unless wired.",
    ],
    blockers: ["Optional YOLOv8n shards under public/models/yolov8n."],
  },
  craft: {
    id: "craft",
    label: "Craft",
    goal: "Aether is the brain; Craft sim is the body — no fake MAVLink radio.",
    constraints: [
      "Craft = simulated hull in the tab, not MAVLink to a vehicle.",
      "Bot VM ≠ laptop; no USB flash.",
      "Propose control/intent APIs inside the existing sim only.",
    ],
    paths: [
      "src/vision/Craft.tsx",
      "src/vision/hull.ts",
      "src/vision/autopilot.ts",
      "src/vision/mavlink.ts",
      "src/aether/plan.ts",
      "src/routes/apps/aether/craft.tsx",
    ],
    nextMoves: [
      "Read hull mode + autopilot order surface.",
      "Propose an intent API (seek/hold/land) the operator can draft.",
      "Keep mavlink.ts as JSON export — never claim a radio link.",
    ],
    blockers: ["No flight controller / hardware in this stack."],
  },
};

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** @returns {OperatorState} */
export function emptyState() {
  return {
    memories: [],
    cards: [],
    projects: [],
    activeCardId: null,
    activeProjectId: null,
  };
}

/**
 * @param {Kv} kv
 * @returns {OperatorState}
 */
export function loadState(kv) {
  try {
    const raw = kv.get(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      activeCardId: parsed.activeCardId ?? null,
      activeProjectId: parsed.activeProjectId ?? null,
    };
  } catch {
    return emptyState();
  }
}

/**
 * @param {Kv} kv
 * @param {OperatorState} state
 */
export function saveState(kv, state) {
  kv.set(
    STORAGE_KEY,
    JSON.stringify({
      memories: state.memories.slice(0, 120),
      cards: state.cards.slice(0, 40),
      projects: state.projects.slice(0, 12),
      activeCardId: state.activeCardId,
      activeProjectId: state.activeProjectId,
    }),
  );
}

/**
 * @param {OperatorState} state
 * @returns {MemoryEntry[]}
 */
export function liveMemories(state) {
  return state.memories.filter((m) => !m.forgotten);
}

/**
 * @param {string} text
 * @param {MemoryKind} kind
 * @param {Record<string, string>=} meta
 * @returns {MemoryEntry}
 */
export function makeMemory(text, kind, meta) {
  return {
    id: uid(),
    kind,
    text: text.trim(),
    meta,
    at: Date.now(),
  };
}

/**
 * @param {string} q
 * @returns {{ kind: MemoryKind, text: string } | null}
 */
export function parseMemoryStatement(q) {
  const s = q.trim();
  const lower = s.toLowerCase();

  let m =
    s.match(/^(?:remember(?: that)?|note that|keep that)\s+(.+)/i) ||
    s.match(/^i (?:usually|always|prefer|hate|like)\s+(.+)/i);
  if (m) {
    const kind = /\b(prefer|usually|always|hate|like)\b/i.test(s) ? "preference" : "fact";
    return { kind, text: m[1].trim() };
  }

  m = s.match(/^(?:my |the )?(?:goal|project)(?: for (\w+))? (?:is|=|:)\s*(.+)/i);
  if (m) return { kind: "project", text: (m[1] ? `${m[1]}: ` : "") + m[2].trim() };

  m = s.match(/^(?:open loop|todo|task)[:\s]+(.+)/i);
  if (m) return { kind: "open_loop", text: m[1].trim() };

  // Life facts without a verb: schedule / constraint style
  if (
    /\b(mon|tue|wed|thu|fri|sat|sun|monday|wednesday|thursday|soccer|practice|demo must|without me)\b/i.test(
      lower,
    ) &&
    !/\b(plan|order|buy|draft|what should|next on|attach)\b/i.test(lower)
  ) {
    return { kind: "fact", text: s };
  }

  return null;
}

/**
 * @param {string} q
 * @returns {boolean}
 */
export function isConfirmPhrase(q) {
  const t = q.trim().toLowerCase();
  if (CONFIRM_PHRASES.test(t) && t.replace(CONFIRM_PHRASES, "").trim().length < 8) return true;
  // bare phrase or phrase + card hint
  return /^(order this|order it|buy this|buy it|send it|call them|do it|go)(\s.+)?$/i.test(t);
}

/**
 * @param {string} q
 * @returns {string|null} project id
 */
export function parseProjectAttach(q) {
  const lower = q.toLowerCase();
  if (/\b(fieldvault|walkdown|site capture)\b/.test(lower)) return "fieldvault";
  if (/\b(eyes|lookout|yolo|coco|vision)\b/.test(lower) && !/\bcraft\b/.test(lower)) return "eyes";
  if (/\b(craft|drone|hull|autopilot|mavlink)\b/.test(lower)) return "craft";
  if (/\battach\b/.test(lower) && /\b(fieldvault|eyes|craft)\b/.test(lower)) {
    if (/\bfieldvault\b/.test(lower)) return "fieldvault";
    if (/\beyes\b/.test(lower)) return "eyes";
    if (/\bcraft\b/.test(lower)) return "craft";
  }
  return null;
}

/**
 * @param {string} q
 * @returns {SkillKind | null}
 */
export function pickSkill(q) {
  const lower = q.toLowerCase();
  // Plan wins for "plan dinner after soccer" — food is for order/get restaurant intents.
  if (/\b(plan|schedule|week|after soccer|break .+ into)\b/.test(lower)) return "plan";
  if (
    /\b(what should happen next|next on|work alongside|be the brain|project brain|attach to|next (?:for|on) (?:craft|fieldvault|eyes))\b/.test(
      lower,
    ) ||
    (/\b(craft|fieldvault|eyes)\b/.test(lower) && /\b(next|brain|alongside|propose)\b/.test(lower))
  )
    return "project";
  if (/\b(craft watch|hull state|what is the hull|simulated hull)\b/.test(lower)) return "craft";
  if (
    /\b(order lunch|order dinner|order food|get food|get lunch|get dinner|restaurant|call (?:the )?restaurant|food)\b/.test(
      lower,
    )
  )
    return "food";
  if (
    /\b(order|buy|parts?|amazon|vendor|cart|screw|bolt|bearing|motor)\b/.test(lower) &&
    !/\b(lunch|dinner|food|pizza|table)\b/.test(lower)
  )
    return "parts";
  return null;
}

/**
 * @param {OperatorState} state
 * @param {string} q
 * @returns {string}
 */
export function memoryContext(state, q) {
  const live = liveMemories(state);
  if (!live.length) return "";
  const lower = q.toLowerCase();
  const scored = live
    .map((m) => {
      const words = m.text.toLowerCase().split(/\W+/).filter(Boolean);
      const hits = words.filter((w) => w.length > 2 && lower.includes(w)).length;
      const kindBoost = m.kind === "lesson" || m.kind === "preference" ? 1 : 0;
      return { m, score: hits + kindBoost };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.m.at - a.m.at)
    .slice(0, 5);
  const rows = scored.length ? scored.map((x) => x.m) : live.slice(0, 4);
  return rows.map((m) => `[${m.kind}] ${m.text}`).join(" · ");
}

/**
 * @param {string} id
 * @returns {ProjectAttach}
 */
export function attachProject(id) {
  const base = PROJECT_MAPS[/** @type {keyof typeof PROJECT_MAPS} */ (id)];
  if (!base) {
    return {
      id,
      label: id,
      goal: "Levi-named path — map existing files before proposing writes.",
      constraints: ["No greenfield repo.", "Prefer src/aether, src/vision, /apps/aether."],
      paths: [],
      nextMoves: ["Name an existing path.", "Read it.", "Propose one next change."],
      blockers: ["Need Levi to name a real path in this repo."],
      attachedAt: Date.now(),
    };
  }
  return { ...base, attachedAt: Date.now() };
}

/**
 * @param {OperatorState} state
 * @param {string} q
 * @param {{ hullLabel?: string }=} env
 * @returns {DraftCard}
 */
export function buildSkillCard(state, q, env = {}) {
  const skill = pickSkill(q) || "plan";
  const mem = memoryContext(state, q);
  const now = Date.now();
  const whenLabel = guessWhen(q);

  if (skill === "food") {
    const place = guessFoodPlace(q) || "a restaurant near you";
    const constraints = liveMemories(state)
      .filter((m) => m.kind === "preference" || /\b(no |allergy|vegetarian|spicy|budget)\b/i.test(m.text))
      .slice(0, 3)
      .map((m) => m.text);
    const message = `Hi, I'd like to place an order${whenLabel ? ` for ${whenLabel}` : ""}. ${constraints.length ? `Notes: ${constraints.join("; ")}. ` : ""}I'll confirm the items when you pick up.`;
    const search = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
    return {
      id: uid(),
      skill: "food",
      title: `Food draft — ${place}`,
      plan: [
        mem ? `Recall: ${mem}` : "No food prefs stored yet.",
        `Pick place: ${place}`,
        "Draft call/order script (Aether does not sit on the restaurant line).",
        "Levi says order this / call them / do it to hand off.",
      ],
      draft: {
        who: place,
        what: `Order food${whenLabel ? ` ${whenLabel}` : ""}`,
        when: whenLabel,
        message,
        copy: message,
        maps: search,
        url: search,
      },
      status: "draft",
      source: q,
      at: now,
    };
  }

  if (skill === "parts") {
    const item = guessPart(q) || "the part Levi named";
    const vendorQ = `${item} buy`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(vendorQ)}`;
    const message = `Looking for: ${item}. Preferred vendor TBD. Please confirm size/qty before checkout.`;
    return {
      id: uid(),
      skill: "parts",
      title: `Parts draft — ${item}`,
      plan: [
        mem ? `Recall: ${mem}` : "No parts prefs yet.",
        `Item: ${item}`,
        "Guess vendor via search URL (no paid API, no card stored).",
        "Levi confirms with buy it / order it — opens search + copies draft.",
      ],
      draft: {
        who: "vendor search",
        what: `Buy ${item}`,
        when: whenLabel,
        message,
        copy: message,
        url,
      },
      status: "draft",
      source: q,
      at: now,
    };
  }

  if (skill === "project" || skill === "craft") {
    const pid =
      parseProjectAttach(q) ||
      state.activeProjectId ||
      (skill === "craft" ? "craft" : "fieldvault");
    const proj = attachProject(pid);
    const moves = proj.nextMoves.slice(0, 3);
    return {
      id: uid(),
      skill: skill === "craft" ? "craft" : "project",
      title: `Project brain — ${proj.label}`,
      plan: [
        `Attach: ${proj.label}`,
        `Goal: ${proj.goal}`,
        `Map (paths only): ${proj.paths.join(", ") || "(none yet)"}`,
        ...moves.map((m, i) => `Next ${i + 1}: ${m}`),
        ...(env.hullLabel && pid === "craft"
          ? [`Hull in tab: ${env.hullLabel} (simulated — not MAVLink).`]
          : []),
      ],
      draft: {
        who: proj.label,
        what: moves[0] || "Propose next code-shaped step",
        when: whenLabel || "this session",
        message: [
          `Brain for ${proj.label}.`,
          `Constraints: ${proj.constraints.join(" ")}`,
          `Blockers needing Levi: ${proj.blockers.join(" ")}`,
          `Proposed next: ${moves.join(" → ")}`,
        ].join("\n"),
        copy: moves.join("\n"),
      },
      status: "draft",
      source: q,
      at: now,
      projectId: proj.id,
    };
  }

  // plan
  const steps = buildPlanSteps(q, state, whenLabel);
  return {
    id: uid(),
    skill: "plan",
    title: `Plan — ${truncate(q, 48)}`,
    plan: steps,
    draft: {
      who: "Levi",
      what: q.trim(),
      when: whenLabel || "this week",
      message: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      copy: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    },
    status: "draft",
    source: q,
    at: now,
  };
}

/**
 * @param {string} q
 * @param {OperatorState} state
 * @param {string=} whenLabel
 * @returns {string[]}
 */
function buildPlanSteps(q, state, whenLabel) {
  const mem = memoryContext(state, q);
  const steps = [];
  if (mem) steps.push(`Use memory: ${mem}`);
  if (/\bafter soccer\b/i.test(q)) {
    steps.push("Soccer ends ~5:30 (from memory if stored).");
    steps.push(whenLabel ? `Target dinner window: ${whenLabel}` : "Dinner window: after practice.");
    steps.push("Pick food constraints from preferences.");
    steps.push("Draft restaurant call/order card for Levi to confirm.");
  } else if (/\bweek\b/i.test(q)) {
    steps.push("List fixed commitments from memory.");
    steps.push("Block deep-work / demo prep on open mornings.");
    steps.push("Leave one recovery slot after evening practices.");
    steps.push("Surfacing open loops that need Levi.");
  } else {
    steps.push(`Clarify outcome for: ${truncate(q, 80)}`);
    steps.push("Break into dated steps Levi can confirm.");
    steps.push("Draft the first action card (food/parts/project as needed).");
  }
  steps.push("Wait for confirm phrase before any handoff.");
  return steps;
}

/** @param {string} q */
function guessWhen(q) {
  const m =
    q.match(/\b(after soccer|tonight|tomorrow|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|~?\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i);
  return m ? m[0] : undefined;
}

/** @param {string} q */
function guessFoodPlace(q) {
  const m = q.match(/\b(?:at|from|order(?:ing)?(?: from)?)\s+([A-Z][\w'&]+(?:\s+[A-Z][\w'&]+){0,3})/);
  if (m) return m[1];
  if (/\bpizza\b/i.test(q)) return "pizza nearby";
  if (/\bthai\b/i.test(q)) return "Thai nearby";
  if (/\bcocktail|burger|mexican|italian|sushi\b/i.test(q)) {
    const c = q.match(/\b(cocktail|burger|mexican|italian|sushi)\b/i);
    return c ? `${c[1]} nearby` : "nearby";
  }
  return "lunch nearby";
}

/** @param {string} q */
function guessPart(q) {
  const m =
    q.match(/\b(?:order|buy|get|need)\s+(?:a |an |the )?(.+?)(?:\s+from\s+.+)?$/i) ||
    q.match(/\bparts?\s+(?:for\s+)?(.+)/i);
  return m ? m[1].replace(/\b(please|now)\b/gi, "").trim() : null;
}

/** @param {string} s @param {number} n */
function truncate(s, n) {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

/**
 * Honest fulfillment — clipboard / URL / tel handoff. Never invent confirmation numbers.
 * @param {DraftCard} card
 * @param {string} whatLeviSaid
 * @param {{
 *   copyText?: (t: string) => boolean,
 *   openUrl?: (url: string) => boolean,
 *   hasTwilio?: boolean,
 *   share?: (t: string) => boolean,
 * }} adapters
 * @returns {{ card: DraftCard, fulfillment: Fulfillment, reply: string }}
 */
export function fulfillCard(card, whatLeviSaid, adapters = {}) {
  const kind = /** @type {FulfillKind} */ (
    card.skill === "food" ? "food" : card.skill === "parts" ? "parts" : /\bcall them\b/i.test(whatLeviSaid) ? "call" : "web"
  );

  /** @type {Fulfillment} */
  const fulfillment = {
    id: uid(),
    kind,
    status: "running",
    whatLeviSaid,
  };

  const sayCall = /\bcall them\b/i.test(whatLeviSaid);
  const copy = card.draft.copy || card.draft.message || "";
  const parts = [];

  let copied = false;
  if (copy && adapters.copyText) {
    copied = !!adapters.copyText(copy);
    if (copied) parts.push("copied order/script to clipboard");
  }

  if (sayCall && card.draft.tel) {
    const opened = adapters.openUrl ? adapters.openUrl(card.draft.tel) : false;
    if (opened) {
      fulfillment.status = "done";
      fulfillment.receipt = `Opened dialer for ${card.draft.who || "place"} at ${new Date().toISOString()}. ${parts.join("; ")}`.trim();
      return {
        card: { ...card, status: "fulfilled", fulfillment },
        fulfillment,
        reply: `Dialer opened for ${card.draft.who || "them"}. Script is on your clipboard if copy worked. Aether does not sit on the line.`,
      };
    }
    if (adapters.hasTwilio) {
      fulfillment.status = "needs_connector";
      fulfillment.failReason =
        "Twilio keys are present in Calling settings, but operator confirm opens tel: first. Use floating Aether “Call” for ring-you-first, or tap the Call action.";
      return {
        card: { ...card, status: "needs_connector", fulfillment },
        fulfillment,
        reply: fulfillment.failReason,
      };
    }
    fulfillment.status = "needs_connector";
    fulfillment.failReason =
      "No phone on this draft. Add a number, or open Maps and call from the listing. Twilio SID/token/from missing for ring-you-first.";
    return {
      card: { ...card, status: "needs_connector", fulfillment },
      fulfillment,
      reply: fulfillment.failReason,
    };
  }

  if (sayCall && !card.draft.tel) {
    const maps = card.draft.maps || card.draft.url;
    if (maps && adapters.openUrl?.(maps)) {
      fulfillment.status = "needs_connector";
      fulfillment.failReason =
        "Opened maps/search so you can call. No tel: on the draft — Aether drafted only. Missing: listed phone or Twilio calling settings.";
      fulfillment.receipt = `Opened ${maps} at ${new Date().toISOString()}. ${copied ? "Script copied." : "Copy failed or empty."}`;
      return {
        card: { ...card, status: "needs_connector", fulfillment },
        fulfillment,
        reply: fulfillment.failReason,
      };
    }
  }

  const url = card.draft.url || card.draft.maps;
  if (url && adapters.openUrl) {
    const opened = adapters.openUrl(url);
    if (opened) parts.push(`opened ${url}`);
  }

  if (adapters.share && copy) {
    try {
      if (adapters.share(copy)) parts.push("shared draft");
    } catch {
      /* ignore */
    }
  }

  if (parts.length) {
    fulfillment.status = card.skill === "project" || card.skill === "plan" ? "done" : "needs_connector";
    fulfillment.receipt = `${card.draft.what} — ${parts.join("; ")} — ${new Date().toISOString()}`;
    if (fulfillment.status === "needs_connector") {
      fulfillment.failReason =
        card.skill === "food"
          ? "Handoff ready (copy + maps/search). No DoorDash/UberEats API and no payment method in this app — finish the order in the vendor UI."
          : card.skill === "parts"
            ? "Opened vendor search + copied draft. No Amazon checkout API and no card numbers stored — Levi completes pay in the vendor tab."
            : "Handoff opened; connector gap if a paid API was expected.";
    }
    const reply =
      fulfillment.status === "done"
        ? `Logged: ${fulfillment.receipt}`
        : `${fulfillment.failReason} Receipt: ${fulfillment.receipt}`;
    return {
      card: {
        ...card,
        status: fulfillment.status === "done" ? "fulfilled" : "needs_connector",
        fulfillment,
      },
      fulfillment,
      reply,
    };
  }

  // At minimum try to treat copy-only as a partial handoff
  if (copied) {
    fulfillment.status = "needs_connector";
    fulfillment.failReason =
      "Copied the draft. Browser blocked opening a URL (or none set). Paste into maps/vendor yourself — no fake order id.";
    fulfillment.receipt = `Clipboard only at ${new Date().toISOString()}`;
    return {
      card: { ...card, status: "needs_connector", fulfillment },
      fulfillment,
      reply: fulfillment.failReason,
    };
  }

  fulfillment.status = "failed";
  fulfillment.failReason =
    "Could not copy or open a handoff URL in this environment (clipboard/window blocked). Draft stays on the card — no order was placed.";
  return {
    card: { ...card, status: "failed", fulfillment },
    fulfillment,
    reply: fulfillment.failReason,
  };
}

/**
 * @param {OperatorState} state
 * @param {string} cardId
 * @param {string} reason
 * @returns {{ state: OperatorState, lesson: MemoryEntry, reply: string }}
 */
export function rejectCard(state, cardId, reason) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) {
    return {
      state,
      lesson: makeMemory("Reject missed — no open card.", "lesson"),
      reply: "No card with that id.",
    };
  }
  const lesson = makeMemory(
    reason?.trim()
      ? `Rejected “${card.title}”: ${reason.trim()}`
      : `Rejected “${card.title}” (${card.skill}). Prefer a different approach next time.`,
    "lesson",
    { cardId: card.id, skill: card.skill },
  );
  const cards = state.cards.map((c) =>
    c.id === cardId ? { ...c, status: /** @type {CardStatus} */ ("rejected") } : c,
  );
  return {
    state: {
      ...state,
      cards,
      memories: [lesson, ...state.memories],
      activeCardId: state.activeCardId === cardId ? null : state.activeCardId,
    },
    lesson,
    reply: `Got it — logged lesson. ${lesson.text}`,
  };
}

/**
 * @param {OperatorState} state
 * @param {string} q
 * @param {{
 *   hullLabel?: string,
 *   hasTwilio?: boolean,
 *   copyText?: (t: string) => boolean,
 *   openUrl?: (url: string) => boolean,
 *   share?: (t: string) => boolean,
 * }=} env
 * @returns {{ state: OperatorState, reply: string, card?: DraftCard, kind: string }}
 */
export function operatorTurn(state, q, env = {}) {
  const text = q.trim();
  if (!text) return { state, reply: "Say a fact, a plan, or a confirm phrase.", kind: "empty" };

  // Confirm / fulfill
  if (isConfirmPhrase(text)) {
    const open = state.cards.filter((c) => c.status === "draft" || c.status === "needs_connector");
    if (!open.length) {
      return {
        state,
        reply: "No draft card is open. Tell me what to plan or order first, then say order it / do it / call them.",
        kind: "need_draft",
      };
    }
    if (open.length > 1 && !state.activeCardId) {
      const names = open.map((c) => `“${c.title}”`).join(" or ");
      return {
        state,
        reply: `Two cards are open: ${names}. Which one? Say the title words, then order it / do it.`,
        kind: "ambiguous",
      };
    }
    const card =
      (state.activeCardId && open.find((c) => c.id === state.activeCardId)) ||
      open[0];
    const executing = { ...card, status: /** @type {CardStatus} */ ("executing") };
    const mid = {
      ...state,
      cards: state.cards.map((c) => (c.id === card.id ? executing : c)),
    };
    const result = fulfillCard(executing, text, env);
    const receiptMem =
      result.fulfillment.receipt || result.fulfillment.failReason
        ? makeMemory(
            result.fulfillment.receipt
              ? `Receipt: ${result.fulfillment.receipt}`
              : `Fulfill gap: ${result.fulfillment.failReason}`,
            result.fulfillment.status === "done" ? "receipt" : "lesson",
            { cardId: card.id, status: result.fulfillment.status },
          )
        : null;
    return {
      state: {
        ...mid,
        cards: mid.cards.map((c) => (c.id === card.id ? result.card : c)),
        memories: receiptMem ? [receiptMem, ...mid.memories] : mid.memories,
        activeCardId: result.card.id,
      },
      reply: result.reply,
      card: result.card,
      kind: "fulfill",
    };
  }

  // Explicit reject
  if (/^(reject|nope|don't|dont|cancel(?: that)?|forget that draft)\b/i.test(text)) {
    const card =
      (state.activeCardId && state.cards.find((c) => c.id === state.activeCardId && c.status === "draft")) ||
      state.cards.find((c) => c.status === "draft");
    if (!card) return { state, reply: "Nothing to reject.", kind: "idle" };
    const reason = text.replace(/^(reject|nope|don't|dont|cancel(?: that)?|forget that draft)\s*/i, "");
    const out = rejectCard(state, card.id, reason);
    return { state: out.state, reply: out.reply, kind: "reject" };
  }

  // Forget memory
  const forget = text.match(/^forget\s+(.+)/i);
  if (forget) {
    const needle = forget[1].toLowerCase();
    let hit = false;
    const memories = state.memories.map((m) => {
      if (!m.forgotten && m.text.toLowerCase().includes(needle)) {
        hit = true;
        return { ...m, forgotten: true };
      }
      return m;
    });
    return {
      state: { ...state, memories },
      reply: hit ? `Forgot anything matching “${forget[1]}”.` : `Nothing matched “${forget[1]}”.`,
      kind: "forget",
    };
  }

  // What do you know
  if (/\b(what do you know|what you know about me|show memory|my memory)\b/i.test(text)) {
    const live = liveMemories(state);
    return {
      state,
      reply: live.length
        ? live.map((m) => `· [${m.kind}] ${m.text}`).join("\n")
        : "Blank slate. Tell me a fact (“soccer Mon/Wed/Thu ~5:30”) and I’ll keep it on-device.",
      kind: "recall",
    };
  }

  // Attach project
  const attachId = parseProjectAttach(text);
  if (attachId && /\b(attach|brain for|work alongside|project)\b/i.test(text) && !pickSkill(text)) {
    const proj = attachProject(attachId);
    const projects = [proj, ...state.projects.filter((p) => p.id !== proj.id)];
    const card = buildSkillCard(
      { ...state, projects, activeProjectId: proj.id },
      `what should happen next on ${proj.label}`,
      env,
    );
    return {
      state: {
        ...state,
        projects,
        activeProjectId: proj.id,
        cards: [card, ...state.cards],
        activeCardId: card.id,
        memories: [
          makeMemory(`Attached project ${proj.label}: ${proj.goal}`, "project", { projectId: proj.id }),
          ...state.memories,
        ],
      },
      reply: `Attached ${proj.label}. Drafted next moves — confirm with do it, or reject.`,
      card,
      kind: "attach",
    };
  }

  // Memory statement
  const mem = parseMemoryStatement(text);
  if (mem && !pickSkill(text)) {
    const entry = makeMemory(mem.text, mem.kind);
    return {
      state: { ...state, memories: [entry, ...state.memories] },
      reply: `Stored [${entry.kind}]: ${entry.text}. Still here after refresh — on-device only.`,
      kind: "remember",
    };
  }

  // Skill draft
  const skill = pickSkill(text);
  if (skill || /\b(plan|order|buy|draft|next)\b/i.test(text)) {
    let next = state;
    const pid = parseProjectAttach(text);
    if (pid && (skill === "project" || skill === "craft")) {
      const proj = attachProject(pid);
      next = {
        ...state,
        projects: [proj, ...state.projects.filter((p) => p.id !== proj.id)],
        activeProjectId: proj.id,
      };
    }
    // Also store incidental memory if the utterance includes a life fact
    const side = parseMemoryStatement(text);
    if (side && memImpliesSchedule(text)) {
      next = { ...next, memories: [makeMemory(side.text, side.kind), ...next.memories] };
    }
    const card = buildSkillCard(next, text, env);
    return {
      state: {
        ...next,
        cards: [card, ...next.cards],
        activeCardId: card.id,
      },
      reply: `Draft ready: ${card.title}. Plan is on the card. Say order it / do it / call them to fulfill, or reject.`,
      card,
      kind: "draft",
    };
  }

  // Default: treat as fact if it looks personal, else help
  if (text.length > 12 && !/\?$/.test(text)) {
    const entry = makeMemory(text, "fact");
    return {
      state: { ...state, memories: [entry, ...state.memories] },
      reply: `Kept as fact: ${entry.text}. Ask me to plan, order food, or be the brain for Craft/FieldVault.`,
      kind: "remember",
    };
  }

  return {
    state,
    reply:
      "Operator loop: tell me a fact, ask for a plan/food/parts/project draft, then confirm with order it / do it / call them. I draft; you approve spend/send/call.",
    kind: "help",
  };
}

/** @param {string} q */
function memImpliesSchedule(q) {
  return /\b(soccer|practice|after)\b/i.test(q);
}

/**
 * @param {MemoryEntry[]} memories
 * @param {string} id
 */
export function forgetMemoryById(memories, id) {
  return memories.map((m) => (m.id === id ? { ...m, forgotten: true } : m));
}
