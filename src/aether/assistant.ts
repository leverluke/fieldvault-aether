import { searchPlaces, type PlaceHit } from "./lookup";
import {
  addAgenda,
  addListItems,
  addReservation,
  cancelLastReservation,
  checkListItem,
  clearList,
  findContact,
  loadAgenda,
  loadContacts,
  loadCallSettings,
  loadLastPlace,
  loadList,
  loadProfile,
  loadReservations,
  loadTasks,
  nextAgenda,
  saveContact,
  saveProfile,
  setLastPlace,
} from "./memory";
import type { Intent } from "./nlu";
import { smsHref, speakPhone, telHref } from "./nlu";
import { convertMoney, convertUnits, distanceBetween, parseDuration } from "./tools";
import type { Action, Reply } from "./types";
import { icsEvent, gmailDraft, gcalUrl } from "./ics";
import { closedNow } from "./hours";
import { bridgeCall } from "./dial";

async function hereFix(): Promise<{ lat: number; lon: number } | undefined> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error("no geo"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 6000,
        maximumAge: 120000,
      });
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return undefined;
  }
}

async function resolvePlace(intent: Intent): Promise<PlaceHit | undefined> {
  if (intent.place && /^(them|there|it|that)$/i.test(intent.place)) {
    intent = { ...intent, place: undefined };
  }
  if (intent.phone && !intent.place) {
    const last = loadLastPlace();
    return {
      name: intent.place || last?.name || "that number",
      address: last?.address || "",
      phone: intent.phone,
      lat: 0,
      lon: 0,
      maps: last?.maps || "",
    };
  }
  const contact = intent.place ? findContact(intent.place) : undefined;
  if (contact?.phone) {
    return {
      name: contact.name,
      address: "",
      phone: contact.phone,
      lat: 0,
      lon: 0,
      maps: "",
    };
  }
  if (!intent.place && /\bthem\b/.test(intent.raw.toLowerCase())) {
    const last = loadLastPlace();
    if (last) {
      return {
        name: last.name,
        address: last.address || "",
        phone: last.phone || intent.phone,
        hours: last.hours,
        lat: 0,
        lon: 0,
        maps: last.maps || "",
      };
    }
  }
  const q = intent.place || intent.category;
  if (!q) return undefined;
  const profile = loadProfile();
  const city = profile.city || "Lima, Ohio";
  const needsCity = !/\b(lima|ohio|oh)\b/i.test(q);
  const geo = await hereFix();
  const hits = await searchPlaces({
    data: {
      q: needsCity ? `${q} ${city}` : q,
      lat: geo?.lat,
      lon: geo?.lon,
    },
  });
  const withPhone = hits.find((h) => h.phone) ?? hits[0];
  if (withPhone) {
    setLastPlace({
      name: withPhone.name,
      address: withPhone.address,
      phone: withPhone.phone || intent.phone,
      hours: withPhone.hours,
      maps: withPhone.maps,
    });
  }
  if (withPhone && intent.phone) withPhone.phone = intent.phone;
  return withPhone;
}

function actionsFor(
  place: {
    name: string;
    phone?: string;
    maps?: string;
    address?: string;
  },
  script?: string,
): Action[] {
  const a: Action[] = [];
  if (place.phone) {
    a.push({ kind: "call", label: "Call", href: telHref(place.phone) });
    a.push({
      kind: "sms",
      label: script ? "Text confirm" : "Text",
      href: smsHref(place.phone, script),
    });
    a.push({ kind: "copy", label: "Copy number", copy: place.phone });
    if (script) a.push({ kind: "copy", label: "Script", copy: script });
  }
  if (place.maps) a.push({ kind: "maps", label: "Maps", href: place.maps });
  return a;
}

function speakPlace(name: string, phone?: string) {
  if (phone) return `${name}. Number is ${speakPhone(phone)}.`;
  return `${name}. I don't have a listed number.`;
}

function scriptFor(place: string, party: number, whenLabel?: string, guest?: string) {
  const who = guest ? ` under ${guest}` : "";
  const when = whenLabel && whenLabel !== "time to confirm" ? ` ${whenLabel}` : "";
  return `Hi, I'd like a table for ${party}${when}${who}.`;
}

async function connectCall(place: { name: string; phone?: string }, script: string, anyway = false): Promise<Reply> {
  const phone = place.phone;
  if (!phone) {
    return { text: `No number for ${place.name} yet. Give me one and I'll dial.`, ran: "call" };
  }
  const closed = anyway ? null : closedNow();
  if (closed) {
    return {
      text: `I won't dial now (${closed}). Say “call anyway” if you still want it.`,
      speak: "They're likely closed. Say call anyway to dial.",
      ran: "call",
      actions: actionsFor(place, script),
    };
  }
  const settings = loadCallSettings();
  const profile = loadProfile();
  const actions = actionsFor(place, script);
  if (settings.twilioSid && settings.twilioToken && settings.twilioFrom && profile.phone) {
    try {
      await bridgeCall({
        data: {
          sid: settings.twilioSid,
          token: settings.twilioToken,
          from: settings.twilioFrom,
          toUser: profile.phone,
          toPlace: phone,
          placeName: place.name.slice(0, 60),
          whisper: `Connecting you to ${place.name}. ${script} Press 1 to put me through.`,
          base: typeof window !== "undefined" ? window.location.origin : undefined,
          missSms: `Aether: missed the ring for ${place.name}. Call them back or say call ${place.name}.`,
        },
      });
      return {
        text: `Twilio: ringing you, whisper, then ${place.name}.\nOn the line, say:\n“${script}”`,
        speak: `Calling you now. I'll announce ${place.name}, then connect.`,
        ran: "call",
        actions,
      };
    } catch {
      /* fall through to the dialer */
    }
  }
  return {
    text: `Dialing ${place.name} (${phone}).\nOn the line, say:\n“${script}”\n${
      profile.phone && settings.twilioSid
        ? ""
        : "A website cannot seize the carrier. On a phone this opens the real dialer. For Aether to ring you first, add your number and a Twilio calling account in Calling."
    }`,
    speak: `Dialing ${place.name}. ${speakPhone(phone)}. ${script}`,
    ran: "call",
    actions,
    dial: settings.autoDial !== false ? telHref(phone) : undefined,
  };
}

export async function runAssistant(intent: Intent): Promise<Reply | null> {
  if (intent.kind === "cancel") {
    const rec = cancelLastReservation();
    if (!rec) return { text: "No reservation draft to cancel.", ran: "reserve" };
    return {
      text: `Cancelled ${rec.party} at ${rec.place}.`,
      speak: `Cancelled ${rec.place}.`,
      ran: "reserve",
    };
  }

  if (intent.kind === "remind") {
    const last = loadLastPlace();
    let task = (intent.item || "that").trim();
    if (last && /\b(them|that|it)\b/i.test(task)) {
      task = task.replace(/\b(them|that|it)\b/gi, last.name);
    }
    const sec = parseDuration(intent.raw) ?? (intent.when ? Math.max(30, Math.round((intent.when - Date.now()) / 1000)) : 0);
    if (!sec || sec < 5) {
      return {
        text: "When? Say “remind me in 20 minutes to call them.”",
        ran: "remind",
      };
    }
    const label = task === "that" && last ? `Call ${last.name}` : task;
    const mins = sec >= 90 ? `${Math.round(sec / 60)} minutes` : `${Math.round(sec)} seconds`;
    addAgenda({ title: label, when: Date.now() + sec * 1000, whenLabel: `in ${mins}` });
    return {
      text: `I'll remind you in ${mins}: ${label}.`,
      speak: `Reminder set. ${mins}. ${label}.`,
      ran: "remind",
      timerSec: sec,
      timerLabel: label,
    };
  }

  if (intent.kind === "list") {
    if (intent.item === "__clear__") {
      clearList();
      return { text: "List cleared.", ran: "list" };
    }
    if (intent.name === "check" && intent.item) {
      const hit = checkListItem(intent.item);
      return hit
        ? { text: `Checked off ${hit.text}.`, ran: "list" }
        : { text: `I don't see ${intent.item} on the list.`, ran: "list" };
    }
    if (intent.name === "add" || intent.item) {
      const parts = (intent.item || "")
        .split(/\s*(?:,| and )\s*/i)
        .map((s) => s.replace(/\bto the list\b/g, "").trim())
        .filter(Boolean);
      const added = addListItems(parts);
      const open = loadList().filter((i) => !i.done);
      if (!added.length) {
        return {
          text: open.length ? `Already on the list. ${open.map((i) => i.text).join(", ")}.` : "Nothing to add.",
          ran: "list",
        };
      }
      return {
        text: `Added ${added.map((i) => i.text).join(", ")}. List: ${open.map((i) => i.text).join(", ") || added.map((i) => i.text).join(", ")}.`,
        ran: "list",
      };
    }
    const open = loadList().filter((i) => !i.done);
    if (!open.length) return { text: "The list is empty. Say “add milk to the list”.", ran: "list" };
    return { text: open.map((i) => i.text).join(", "), ran: "list" };
  }

  if (intent.kind === "agenda") {
    const rec = addAgenda({
      title: intent.item || "Event",
      when: intent.when,
      whenLabel: intent.whenLabel,
    });
    return {
      text: `On the agenda: ${rec.title}${rec.whenLabel ? `, ${rec.whenLabel}` : ""}.`,
      ran: "agenda",
    };
  }

  if (intent.kind === "next") {
    const n = nextAgenda();
    const r = loadReservations()[0];
    const tasks = loadTasks().filter((t) => !t.done);
    const lines: string[] = [];
    if (n) lines.push(`Next: ${n.title}${n.whenLabel ? ` · ${n.whenLabel}` : ""}.`);
    if (r) lines.push(`Reservation: ${r.party} at ${r.place}${r.whenLabel ? `, ${r.whenLabel}` : ""}.`);
    if (tasks.length) lines.push(`Open tasks: ${tasks.map((t) => t.text).join("; ")}.`);
    const open = loadList().filter((i) => !i.done);
    if (open.length) lines.push(`List: ${open.map((i) => i.text).join(", ")}.`);
    if (!lines.length) return { text: "Nothing on the agenda. Add a meeting or a reservation.", ran: "next" };
    return { text: lines.join(" "), ran: "next" };
  }

  if (intent.kind === "convert" && intent.amount != null && intent.from && intent.to) {
    if (intent.name === "money") {
      try {
        return { text: await convertMoney(intent.amount, intent.from, intent.to), ran: "convert" };
      } catch {
        return { text: "Currency feed didn't answer.", ran: "convert" };
      }
    }
    const line = convertUnits(intent.amount, intent.from, intent.to);
    return { text: line || "I don't convert those units.", ran: "convert" };
  }

  if (intent.kind === "distance") {
    const profile = loadProfile();
    const to = intent.to || intent.place;
    const from = intent.from || profile.city || "Lima, Ohio";
    if (!to) return { text: "How far to where?", ran: "distance" };
    try {
      const d = await distanceBetween(from, to);
      const maps = d.to
        ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`
        : undefined;
      return {
        text: d.line,
        ran: "distance",
        actions: maps ? [{ kind: "maps", label: "Directions", href: maps }] : undefined,
      };
    } catch {
      return { text: "I couldn't measure that.", ran: "distance" };
    }
  }

  if (intent.kind === "profile") {
    const p = saveProfile({
      city: intent.city,
      party: intent.party,
      name: intent.name,
      phone: intent.phone,
    });
    const bits = [
      p.name ? p.name : "",
      p.city || "your city",
      `party of ${p.party ?? 2}`,
      p.phone ? p.phone : "no phone yet",
    ].filter(Boolean);
    return {
      text: `I'll use ${bits.join(", ")}.`,
      speak: `Got it. ${p.city || "your city"}.`,
      ran: "profile",
    };
  }

  if (intent.kind === "contactSave") {
    const c = saveContact({
      name: intent.name || "Saved",
      phone: intent.phone,
      email: intent.email,
    });
    return {
      text: c.phone
        ? `Saved ${c.name} at ${c.phone}.`
        : `Saved ${c.name}. Add a number when you have it.`,
      speak: c.phone
        ? `Saved ${c.name}. ${speakPhone(c.phone)}.`
        : `Saved ${c.name}.`,
      ran: "contact",
      actions: c.phone ? actionsFor({ name: c.name, phone: c.phone }) : undefined,
    };
  }

  if (intent.kind === "contacts") {
    const all = loadContacts();
    if (!all.length) return { text: "No contacts yet. Say “remember Shawnee is 419-555-0100”.", ran: "contact" };
    return {
      text: all.slice(0, 10).map((c) => `${c.name}${c.phone ? ` · ${c.phone}` : ""}`).join("\n"),
      speak: `${all.length} saved.`,
      ran: "contact",
    };
  }

  if (intent.kind === "reservations") {
    const all = loadReservations();
    if (!all.length) return { text: "No reservation drafts yet.", ran: "reserve" };
    return {
      text: all
        .slice(0, 6)
        .map((r) => `${r.place} · ${r.party} · ${r.whenLabel || "time TBD"}`)
        .join("\n"),
      ran: "reserve",
    };
  }

  if (intent.kind === "contactGet" && intent.place) {
    const c = findContact(intent.place);
    if (!c) return { text: `I don't have ${intent.place} saved.`, ran: "contact" };
    return {
      text: `${c.name}${c.phone ? ` · ${c.phone}` : ""}`,
      speak: speakPlace(c.name, c.phone),
      ran: "contact",
      actions: actionsFor(c),
    };
  }

  if (
    intent.kind === "find" ||
    intent.kind === "nearby" ||
    intent.kind === "hours" ||
    intent.kind === "directions" ||
    intent.kind === "call" ||
    intent.kind === "reserve" ||
    intent.kind === "sms"
  ) {
    if (intent.kind === "call" && intent.phone && !intent.place) {
      const profile = loadProfile();
      return connectCall(
        { name: "that number", phone: intent.phone },
        scriptFor("them", profile.party || 2, undefined, profile.name),
        /\banyway\b/.test(intent.raw),
      );
    }

    const query = intent.place || intent.category;
    if (!query && !intent.phone && intent.kind !== "nearby") {
      const last = loadLastPlace();
      if (last && (intent.kind === "call" || intent.kind === "sms" || intent.kind === "directions" || intent.kind === "hours")) {
        intent.place = "them";
      } else {
        return {
          text: "Give me a place, a saved name, or a number.",
          ran: intent.kind,
        };
      }
    }

    if (intent.kind === "nearby" && !intent.place) {
      intent.place = intent.category;
    }

    let place: PlaceHit | undefined;
    try {
      place = await resolvePlace(intent);
    } catch {
      return {
        text: "Place lookup didn't answer. Try a name plus the city, or just give me the number.",
        ran: "find",
      };
    }

    if (!place && intent.phone) {
      place = {
        name: intent.place || "that number",
        address: "",
        phone: intent.phone,
        lat: 0,
        lon: 0,
        maps: "",
      };
    }

    if (!place) {
      return {
        text: `I couldn't find ${query} in map data. Say the phone number and I'll still set this up.`,
        ran: "find",
      };
    }

    if (intent.phone) place.phone = intent.phone;

    if (intent.kind === "sms") {
      if (!place.phone) {
        return { text: `No number for ${place.name} yet.`, ran: "sms" };
      }
      return {
        text: `Text ready for ${place.name}.`,
        speak: `Opening a text to ${place.name}.`,
        ran: "sms",
        actions: [
          {
            kind: "sms",
            label: "Text confirm",
            href: smsHref(
              place.phone,
              intent.body ||
                scriptFor(place.name, loadReservations()[0]?.party || loadProfile().party || 2, loadReservations()[0]?.whenLabel, loadProfile().name),
            ),
          },
        ],
      };
    }

    if (intent.kind === "directions") {
      const href =
        place.maps ||
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address || place.name)}`;
      if (typeof window !== "undefined") window.open(href, "_blank", "noopener");
      return {
        text: `Directions to ${place.name}${place.address ? ` · ${place.address}` : ""}.`,
        speak: `Directions to ${place.name}.`,
        ran: "maps",
        actions: [{ kind: "maps", label: "Maps", href }],
      };
    }

    if (intent.kind === "hours") {
      return {
        text: place.hours
          ? `${place.name}: ${place.hours}`
          : `No hours listed for ${place.name}.`,
        speak: place.hours
          ? `${place.name} hours. ${place.hours}.`
          : `No hours listed.`,
        ran: "hours",
        actions: actionsFor(place),
      };
    }

    if (intent.kind === "find" || intent.kind === "nearby" || intent.kind === "call") {
      if (intent.kind === "call") {
        const profile = loadProfile();
        const last = loadReservations()[0];
        const party = last?.party || profile.party || 2;
        const when = last?.whenLabel;
        return connectCall(place, scriptFor(place.name, party, when, profile.name), /\banyway\b/.test(intent.raw));
      }
      const hours = place.hours ? `\nHours: ${place.hours}` : "";
      const phone = place.phone ? `\n${place.phone}` : "\nNo listed phone.";
      return {
        text: `${place.name}\n${place.address}${phone}${hours}`,
        speak: speakPlace(place.name, place.phone),
        ran: "find",
        actions: actionsFor(place),
      };
    }

    const profile = loadProfile();
    const party = intent.party || profile.party || 2;
    const whenLabel = intent.whenLabel || "time to confirm";
    const rec = addReservation({
      place: place.name,
      address: place.address,
      phone: place.phone,
      party,
      when: intent.when,
      whenLabel,
      script: scriptFor(place.name, party, whenLabel, profile.name),
    });
    saveContact({ name: place.name, phone: place.phone });
    if (intent.when && intent.when > Date.now() + 10 * 60 * 1000) {
      addAgenda({
        title: `Call ${place.name}`,
        when: intent.when - 60 * 60 * 1000,
        whenLabel: "an hour before",
      });
    }
    const lead =
      intent.when && intent.when > Date.now() + 10 * 60 * 1000
        ? " I'll ping you an hour before."
        : "";
    try {
      icsEvent({
        title: `${party} at ${place.name}`,
        when: intent.when,
        where: place.address,
        body: place.phone || "",
      });
    } catch {
      /* ignore */
    }
    const script = scriptFor(place.name, party, rec.whenLabel, profile.name);
    const settings = loadCallSettings();
    const mode =
      settings.twilioSid && profile.phone
        ? "Twilio will ring you first, whisper the table, then connect."
        : "Call opens your phone dialer. You talk.";
    return {
      text: `Draft: ${rec.party} at ${rec.place}, ${rec.whenLabel}.${
        rec.phone ? ` ${rec.phone}.` : " No listed number."
      }${lead}\n${mode}\nOn the line: “${script}”`,
      speak: `Draft for ${rec.party} at ${rec.place}, ${rec.whenLabel}. ${
        rec.phone
          ? `Number is ${speakPhone(rec.phone)}. ${mode}`
          : "I don't have a number."
      }`,
      ran: "reserve",
      actions: [
        ...actionsFor(place, script),
        { kind: "mail", label: "Gmail draft", href: gmailDraft("", `Reservation ${place.name}`, script) },
        { kind: "mail", label: "Google Calendar", href: gcalUrl({ title: `${party} at ${place.name}`, when: intent.when, where: place.address, body: script }) },
      ],
    };
  }

  return null;
}
