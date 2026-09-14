import {
  forgetMemoryById,
  liveMemories,
  loadState,
  operatorTurn,
  rejectCard,
  saveState,
} from "./core.js";
import type { DraftCard, MemoryEntry, OperatorState, ProjectAttach } from "./core.js";
import { loadCallSettings } from "../memory";
import { hullCopy } from "@/vision/hull";

export type {
  DraftCard,
  MemoryEntry,
  OperatorState,
  ProjectAttach,
  Fulfillment,
  SkillKind,
  MemoryKind,
} from "./core.js";

export {
  CONFIRM_PHRASES,
  PROJECT_MAPS,
  attachProject,
  buildSkillCard,
  isConfirmPhrase,
  liveMemories,
  operatorTurn,
  parseMemoryStatement,
  pickSkill,
  rejectCard,
  fulfillCard,
  emptyState,
} from "./core.js";

const browserKv = {
  get(k: string) {
    if (typeof localStorage === "undefined") return null;
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(k, v);
    } catch {
      /* quota */
    }
  },
  remove(k: string) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export function loadOperator(): OperatorState {
  return loadState(browserKv);
}

export function saveOperator(state: OperatorState) {
  saveState(browserKv, state);
}

function browserAdapters() {
  const cs = loadCallSettings();
  return {
    hullLabel: hullCopy().label,
    hasTwilio: !!(cs.twilioSid && cs.twilioToken && cs.twilioFrom),
    copyText(t: string) {
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) return true;
      } catch {
        /* fall through */
      }
      // Async clipboard can reject without a sync throw — never claim success from the promise alone.
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(t).catch(() => undefined);
      }
      return false;
    },
    openUrl(url: string) {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        return true;
      } catch {
        try {
          window.location.href = url;
          return true;
        } catch {
          return false;
        }
      }
    },
    share(t: string) {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        void navigator.share({ text: t });
        return true;
      }
      return false;
    },
  };
}

export function runOperator(q: string): {
  state: OperatorState;
  reply: string;
  card?: DraftCard;
  kind: string;
} {
  const state = loadOperator();
  const out = operatorTurn(state, q, browserAdapters());
  saveOperator(out.state);
  return out;
}

export function confirmActiveCard(phrase: string) {
  return runOperator(phrase);
}

export function rejectActive(reason = "") {
  const state = loadOperator();
  const card =
    (state.activeCardId && state.cards.find((c) => c.id === state.activeCardId)) ||
    state.cards.find((c) => c.status === "draft");
  if (!card) return { state, reply: "Nothing to reject.", kind: "idle" as const };
  const out = rejectCard(state, card.id, reason);
  saveOperator(out.state);
  return { state: out.state, reply: out.reply, kind: "reject" as const };
}

export function listKnownAboutYou(): MemoryEntry[] {
  return liveMemories(loadOperator());
}

export function forgetKnown(id: string) {
  const state = loadOperator();
  const next = { ...state, memories: forgetMemoryById(state.memories, id) };
  saveOperator(next);
  return next;
}

export function editKnown(id: string, text: string) {
  const state = loadOperator();
  const memories = state.memories.map((m) =>
    m.id === id ? { ...m, text: text.trim(), at: Date.now() } : m,
  );
  const next = { ...state, memories };
  saveOperator(next);
  return next;
}

export function setActiveCard(id: string | null) {
  const state = loadOperator();
  const next = { ...state, activeCardId: id };
  saveOperator(next);
  return next;
}

export type { DraftCard as OperatorDraftCard, ProjectAttach as OperatorProject };
