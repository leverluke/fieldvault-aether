export type Note = { id: string; text: string; at: number };
export type Task = { id: string; text: string; done: boolean };
export type TimerRec = {
  id: string;
  label: string;
  ends: number;
  handle: ReturnType<typeof setTimeout> | null;
};
export type Contact = { id: string; name: string; phone?: string; email?: string };
export type Reservation = {
  id: string;
  place: string;
  address?: string;
  phone?: string;
  party: number;
  when?: number;
  whenLabel?: string;
  note?: string;
  script?: string;
  at: number;
};
export type Profile = { name?: string; city?: string; party?: number; phone?: string };

export type CallSettings = {
  autoDial: boolean;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
};

const CALLING = "aether-calling";
export type LastPlace = {
  name: string;
  address?: string;
  phone?: string;
  hours?: string;
  maps?: string;
};

const NOTES = "aether-notes";
const TASKS = "aether-tasks";
const MUTED = "aether-muted";
const LISTEN = "aether-listen";
const CONTACTS = "aether-contacts";
const RESERVE = "aether-reservations";
const PROFILE = "aether-profile";
const LAST = "aether-last-place";
const LIST = "aether-list";
const AGENDA = "aether-agenda";
export type ListItem = { id: string; text: string; done: boolean };
export type AgendaItem = {
  id: string;
  title: string;
  when?: number;
  whenLabel?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadNotes(): Note[] {
  return read<Note[]>(NOTES, []);
}

export function addNote(text: string): Note {
  const note = { id: uid(), text, at: Date.now() };
  write(NOTES, [note, ...loadNotes()].slice(0, 50));
  return note;
}

export function clearNotes() {
  write(NOTES, []);
}

export function loadTasks(): Task[] {
  return read<Task[]>(TASKS, []);
}

export function addTask(text: string): Task {
  const task = { id: uid(), text, done: false };
  write(TASKS, [...loadTasks(), task]);
  return task;
}

export function completeTask(query: string): Task | null {
  const q = query.toLowerCase();
  const tasks = loadTasks();
  const hit =
    tasks.find((t) => !t.done && t.text.toLowerCase().includes(q)) ??
    tasks.find((t) => !t.done);
  if (!hit) return null;
  write(
    TASKS,
    tasks.map((t) => (t.id === hit.id ? { ...t, done: true } : t)),
  );
  return hit;
}

export function isMuted() {
  return read<boolean>(MUTED, false);
}

export function setMuted(v: boolean) {
  write(MUTED, v);
}

export function isAlwaysListen() {
  return read<boolean>(LISTEN, false);
}

export function setAlwaysListen(v: boolean) {
  write(LISTEN, v);
}

export function loadContacts(): Contact[] {
  return read<Contact[]>(CONTACTS, []);
}

export function saveContact(c: Omit<Contact, "id">): Contact {
  const contacts = loadContacts();
  const existing = contacts.find(
    (x) => x.name.toLowerCase() === c.name.toLowerCase(),
  );
  if (existing) {
    const next = { ...existing, ...c };
    write(
      CONTACTS,
      contacts.map((x) => (x.id === existing.id ? next : x)),
    );
    return next;
  }
  const rec = { id: uid(), ...c };
  write(CONTACTS, [rec, ...contacts].slice(0, 80));
  return rec;
}

export function findContact(q: string): Contact | undefined {
  const n = q.toLowerCase().trim();
  if (!n) return undefined;
  const all = loadContacts();
  return (
    all.find((c) => c.name.toLowerCase() === n) ||
    all.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()))
  );
}

export function loadReservations(): Reservation[] {
  return read<Reservation[]>(RESERVE, []);
}

export function addReservation(r: Omit<Reservation, "id" | "at">): Reservation {
  const rec = { id: uid(), at: Date.now(), ...r };
  write(RESERVE, [rec, ...loadReservations()].slice(0, 40));
  return rec;
}

export function noteReservation(note: string): Reservation | null {
  const all = loadReservations();
  if (!all[0]) return null;
  const next = [{ ...all[0], note }, ...all.slice(1)];
  write(RESERVE, next);
  return next[0];
}

export function cancelLastReservation(): Reservation | null {
  const all = loadReservations();
  if (!all.length) return null;
  const [first, ...rest] = all;
  write(RESERVE, rest);
  return first;
}

export function loadProfile(): Profile {
  return read<Profile>(PROFILE, { city: "Lima, Ohio", party: 2 });
}

export function saveProfile(p: Partial<Profile>): Profile {
  const next = { ...loadProfile(), ...p };
  write(PROFILE, next);
  return next;
}

export function loadCallSettings(): CallSettings {
  return read<CallSettings>(CALLING, { autoDial: true });
}

export function saveCallSettings(p: Partial<CallSettings>): CallSettings {
  const next = { ...loadCallSettings(), ...p };
  write(CALLING, next);
  return next;
}

export function loadLastPlace(): LastPlace | null {
  return read<LastPlace | null>(LAST, null);
}

export function setLastPlace(p: LastPlace | null) {
  if (!p) localStorage.removeItem(LAST);
  else write(LAST, p);
}

export function loadList(): ListItem[] {
  return read<ListItem[]>(LIST, []);
}

export function addListItems(texts: string[]): ListItem[] {
  const cur = loadList();
  const added: ListItem[] = [];
  for (const raw of texts) {
    const text = raw.trim();
    if (!text) continue;
    if (cur.some((i) => i.text.toLowerCase() === text.toLowerCase() && !i.done)) continue;
    added.push({ id: uid(), text, done: false });
  }
  write(LIST, [...cur, ...added].slice(0, 80));
  return added;
}

export function checkListItem(q: string): ListItem | null {
  const n = q.toLowerCase();
  const cur = loadList();
  const hit = cur.find((i) => !i.done && i.text.toLowerCase().includes(n));
  if (!hit) return null;
  write(
    LIST,
    cur.map((i) => (i.id === hit.id ? { ...i, done: true } : i)),
  );
  return hit;
}

export function clearList() {
  write(LIST, []);
}

export function loadAgenda(): AgendaItem[] {
  return read<AgendaItem[]>(AGENDA, []).sort((a, b) => (a.when ?? 0) - (b.when ?? 0));
}

export function addAgenda(item: Omit<AgendaItem, "id">): AgendaItem {
  const rec = { id: uid(), ...item };
  write(AGENDA, [...loadAgenda(), rec].slice(-40));
  return rec;
}

export function nextAgenda(now = Date.now()): AgendaItem | undefined {
  return loadAgenda().find((a) => !a.when || a.when >= now - 15 * 60 * 1000);
}

export const timers: TimerRec[] = [];

const TIMERS = "aether-timers";

export function persistTimers() {
  write(
    TIMERS,
    timers.map((t) => ({ id: t.id, label: t.label, ends: t.ends })),
  );
}

export function restoreTimers(onFire: (label: string) => void) {
  const saved = read<{ id: string; label: string; ends: number }[]>(TIMERS, []);
  const now = Date.now();
  for (const s of saved) {
    if (s.ends <= now) {
      onFire(s.label);
      continue;
    }
    const rec: TimerRec = { ...s, handle: null };
    rec.handle = setTimeout(() => {
      const i = timers.findIndex((t) => t.id === rec.id);
      if (i >= 0) timers.splice(i, 1);
      persistTimers();
      onFire(rec.label);
    }, s.ends - now);
    timers.push(rec);
  }
}
