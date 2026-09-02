import {
  addListItems,
  addNote,
  addTask,
  checkListItem,
  completeTask,
  loadList,
  loadNotes,
  loadReservations,
  loadTasks,
  nextAgenda,
  noteReservation,
  saveContact,
} from "../memory";
import { setFact } from "./facts";
import { addWatcher, clearWatchers, listWatchers } from "./watchers";
import { getRoutine, listRoutines, saveRoutine } from "./routines";
import { canonicalClass } from "@/vision/classes";
import { rememberName } from "@/vision/room";
import { getLastFrame } from "../bus";
import { setSeek } from "@/vision/detector";
import { teachObject, takePendingTeach } from "@/vision/teach";
import type { Reply } from "../types";

function after(q: string, re: RegExp) {
  return q.match(re)?.[1]?.trim() || "";
}

export function runMemory(q: string): Reply | null {
  if (/\bthis is (.+)/.test(q) || /\bcall that (.+)/.test(q) || /\bname that (.+)/.test(q)) {
    const name = after(q, /(?:this is|call that|name that) (.+)/);
    const pending = takePendingTeach();
    if (pending && name) {
      teachObject(name, pending.vec, pending.hint);
      return { text: `Kept as ${name}. I'll look for it next time.`, ran: "memory" };
    }
  }
  if (/\b(they said|note on the (reservation|booking)|after the call)\b/.test(q)) {
    const note = after(q, /(?:they said|note on the (?:reservation|booking)|after the call)[:\s]+(.+)/) || q;
    const rec = noteReservation(note);
    return rec
      ? { text: `Noted on ${rec.place}: ${rec.note}`, ran: "memory" }
      : { text: "No reservation to attach that to.", ran: "memory" };
  }
  const phoneHit = q.match(/\b(?:save )?(\w+) (?:is|as) (\+?[\d][\d .\-()]{8,})\b/);
  if (phoneHit) {
    saveContact({ name: phoneHit[1], phone: phoneHit[2] });
    return { text: `Saved ${phoneHit[1]} ${phoneHit[2]}. Say “call ${phoneHit[1]}”.`, ran: "memory" };
  }
  if (/\bremember (that )?(.+?) (is|=) (.+)/.test(q) || /\bremember the (.+?) is (.+)/.test(q)) {
    const m =
      q.match(/\bremember (?:that )?(.+?) (?:is|=) (.+)/) ||
      q.match(/\bremember the (.+?) is (.+)/);
    if (m) {
      setFact(m[1], m[2]);
      return { text: `Remembered ${m[1].trim()}: ${m[2].trim()}.`, ran: "memory" };
    }
  }

  if (/\b(tell me when you see|watch for|alert me (when|if) you see)\b/.test(q)) {
    const cls = canonicalClass(q) || after(q, /see (?:a |the |an )?(.+)/);
    if (!cls) return { text: "Watch for what?", ran: "memory" };
    addWatcher(cls);
    setSeek(cls);
    return { text: `I'll speak when I see ${cls}.`, speak: `Watching for ${cls}.`, ran: "memory" };
  }

  if (/\b(stop watching|clear watchers)\b/.test(q)) {
    clearWatchers();
    return { text: "Watchers cleared.", ran: "memory" };
  }

  if (/\bwhat are you watching\b/.test(q)) {
    const w = listWatchers();
    return { text: w.length ? `Watching ${w.map((x) => x.cls).join(", ")}.` : "Nothing.", ran: "memory" };
  }

  if (/\brun (?:my |the )?(morning|leave|inspect|[a-z]+)\b/.test(q) || /\b(good morning|head out|inspect the room)\b/.test(q)) {
    const name = q.match(/\brun (?:my |the )?([a-z]+)/)?.[1] || (/\bgood morning\b/.test(q) ? "morning" : /\bhead out\b/.test(q) ? "leave" : /\binspect\b/.test(q) ? "inspect" : "");
    const r = getRoutine(name);
    if (r) return { text: `ROUTINE:${r.name}`, ran: "routine", speak: `Running ${r.name}.` };
  }

  if (/\bsave routine ([a-z]+) as (.+)/.test(q)) {
    const m = q.match(/\bsave routine ([a-z]+) as (.+)/);
    if (m) {
      saveRoutine(m[1], m[2].split(/\s*(?:,| then )\s*/));
      return { text: `Saved routine ${m[1]}.`, ran: "memory" };
    }
  }

  if (/\b(routines|what routines)\b/.test(q)) {
    return { text: listRoutines().map((r) => `${r.name}: ${r.steps.join(" → ")}`).join("\n"), ran: "memory" };
  }

  if (/\bthat (?:is|chair is|box is|one is) (.+)/.test(q) || /\bcall that (.+)/.test(q) || /\bname (?:that|it) (.+)/.test(q)) {
    const name = after(q, /(?:that (?:is|chair is|box is|one is)|call that|name (?:that|it)) (.+)/);
    const box = getLastFrame()?.objects.find((o) => o.layer !== "bg") || getLastFrame()?.objects[0];
    if (box?.id != null && name) {
      rememberName(box.id, name);
      return { text: `#${box.id} is ${name}.`, ran: "memory" };
    }
    return { text: "Tap a box in Eyes first, or have one in frame.", ran: "memory" };
  }

  if (/\badd (.+) to (?:the |my )?(?:list|grocery)\b/.test(q) || /\bneed (.+)\b/.test(q)) {
    const item = after(q, /add (.+) to/) || after(q, /need (.+)/);
    if (item) {
      addListItems(item.split(/\s*(?:,| and )\s*/));
      return { text: `On the list: ${item}.`, ran: "memory" };
    }
  }

  if (/\b(what's on the list|grocery|my list)\b/.test(q)) {
    const rows = loadList().filter((i) => !i.done);
    return { text: rows.length ? rows.map((i) => i.text).join(", ") : "List is empty.", ran: "memory" };
  }

  if (/\bcheck off (.+)\b/.test(q) || /\bgot the (.+)\b/.test(q)) {
    const item = after(q, /(?:check off|got the) (.+)/);
    const hit = item ? checkListItem(item) : null;
    return { text: hit ? `Checked ${hit.text}.` : "Not on the list.", ran: "memory" };
  }

  if (/\b(note that|make a note|note:) (.+)/.test(q)) {
    const text = after(q, /(?:note that|make a note|note:)\s*(.+)/);
    if (text) {
      addNote(text);
      return { text: "Noted.", ran: "memory" };
    }
  }

  if (/\b(my notes|read notes)\b/.test(q)) {
    const rows = loadNotes().slice(0, 5);
    return { text: rows.length ? rows.map((n) => n.text).join("\n") : "No notes.", ran: "memory" };
  }

  if (/\b(add a task|todo) (.+)/.test(q)) {
    const text = after(q, /(?:add a task|todo) (.+)/);
    if (text) {
      addTask(text);
      return { text: `Task: ${text}.`, ran: "memory" };
    }
  }

  if (/\b(done with|finish) (.+)/.test(q)) {
    const hit = completeTask(after(q, /(?:done with|finish) (.+)/));
    return { text: hit ? `Done: ${hit.text}.` : "No matching task.", ran: "memory" };
  }

  if (/\b(what's next|agenda|my tasks)\b/.test(q)) {
    const nxt = nextAgenda();
    const open = loadTasks().filter((t) => !t.done);
    const bits = [nxt ? `Next: ${nxt.title}${nxt.whenLabel ? ` ${nxt.whenLabel}` : ""}.` : "", open.length ? `Tasks: ${open.map((t) => t.text).join("; ")}.` : ""].filter(Boolean);
    return { text: bits.join(" ") || "Nothing queued.", ran: "memory" };
  }

  return null;
}

export { getRoutine };
