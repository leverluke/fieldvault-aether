export type IntentKind =
  | "reserve"
  | "call"
  | "find"
  | "nearby"
  | "directions"
  | "sms"
  | "contactSave"
  | "contactGet"
  | "contacts"
  | "reservations"
  | "profile"
  | "hours"
  | "list"
  | "agenda"
  | "convert"
  | "distance"
  | "next"
  | "remind"
  | "cancel"
  | "other";

export type Intent = {
  kind: IntentKind;
  raw: string;
  place?: string;
  phone?: string;
  party?: number;
  when?: number;
  whenLabel?: string;
  category?: string;
  name?: string;
  email?: string;
  body?: string;
  city?: string;
  item?: string;
  amount?: number;
  from?: string;
  to?: string;
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const NEARBY: Record<string, string> = {
  coffee: "coffee",
  cafe: "coffee",
  "gas station": "fuel",
  gas: "fuel",
  pharmacy: "pharmacy",
  pizza: "pizza",
  italian: "italian restaurant",
  chinese: "chinese restaurant",
  mexican: "mexican restaurant",
  plumber: "plumber",
  hardware: "hardware store",
  hospital: "hospital",
  atm: "atm",
  bar: "bar",
  diner: "diner",
  grocery: "supermarket",
};

export function digitsPhone(s: string): string | undefined {
  const m = s.match(
    /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/,
  );
  if (!m) return undefined;
  const d = m[0].replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return undefined;
}

export function telHref(phone: string) {
  return `tel:${phone}`;
}

export function smsHref(phone: string, body?: string) {
  const b = body ? `?body=${encodeURIComponent(body)}` : "";
  return `sms:${phone}${b}`;
}

export function speakPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^1/, "");
  if (d.length !== 10) return phone;
  const chunk = (s: string) => s.split("").join(" ");
  return `${chunk(d.slice(0, 3))}. ${chunk(d.slice(3, 6))}. ${chunk(d.slice(6))}`;
}

function partySize(q: string): number | undefined {
  const four = q.match(/\b(four|4)[ -]?top\b/);
  if (four) return 4;
  const two = q.match(/\b(two|2)[ -]?top\b/);
  if (two) return 2;
  const m = q.match(
    /\b(?:table for|party of|for)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:people|guests|of us)\b/,
  );
  if (m) return Number(m[1] || m[2]);
  return undefined;
}

function parseWhen(q: string): { at?: number; label?: string } {
  const now = new Date();
  let day = new Date(now);
  let dayHit = false;
  if (/\btomorrow\b/.test(q)) {
    day.setDate(day.getDate() + 1);
    dayHit = true;
  } else if (/\btonight\b/.test(q)) {
    dayHit = true;
  } else if (/\btoday\b/.test(q)) {
    dayHit = true;
  } else {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(q)) {
        const add = (i - now.getDay() + 7) % 7 || 7;
        day.setDate(now.getDate() + add);
        dayHit = true;
        break;
      }
    }
  }
  const tm =
    q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/) ||
    q.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/) ||
    q.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/) ||
    q.match(
      /\b(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday|tomorrow|tonight|today)\s+(\d{1,2})\b/,
    );
  let hour: number | undefined;
  let min = 0;
  if (tm && !/^\d{3,}/.test(tm[0])) {
    hour = Number(tm[1]);
    min = Number(tm[2] || 0);
    const ap = (tm[3] || "").toLowerCase();
    if (ap.startsWith("p") && hour < 12) hour += 12;
    if (ap.startsWith("a") && hour === 12) hour = 0;
    if (!ap && hour >= 1 && hour <= 7) hour += 12;
  } else if (/\bnoon\b/.test(q)) {
    hour = 12;
  } else if (/\bmidnight\b/.test(q)) {
    hour = 0;
  } else if (/\btonight\b/.test(q)) {
    hour = 19;
  }
  if (!dayHit && hour == null) return {};
  if (hour == null) hour = 19;
  day.setHours(hour, min, 0, 0);
  const label = day.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return { at: day.getTime(), label };
}

function stripPlace(q: string) {
  return q
    .replace(/(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/g, " ")
    .replace(
      /\b(please|hey|aether|ok|okay|can you|could you|would you|i want you to|go ahead and|get us|get me|book|reserve|reservation|table for|party of|four-top|4-top|two-top|call|phone|dial|find|look up|lookup|search|directions to|navigate to|take me to|hours for|open hours|nearby|near me|a table|a spot)\b/g,
      " ",
    )
    .replace(/\b(saturday|sunday|monday|tuesday|wednesday|thursday|friday|tomorrow|tonight|today)\b/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?\b/g, " ")
    .replace(/\b(for|at|on|the|a|an|in|of|us|people|guests)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryOf(q: string): string | undefined {
  for (const [k, v] of Object.entries(NEARBY)) {
    if (q.includes(k)) return v;
  }
  return undefined;
}

export function parseIntent(raw: string): Intent {
  const q = raw
    .toLowerCase()
    .replace(/[?!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const phone = digitsPhone(raw);
  const party = partySize(q);
  const when = parseWhen(q);
  const place = stripPlace(q) || undefined;
  const cat = categoryOf(q);

  function after(s: string, re: RegExp) {
    const m = s.match(re);
    return m?.[1]?.trim() || "";
  }

  if (
    /\b(what do you see|what.?s in (the )?(frame|shot|picture)|start (the )?camera|stop (the )?camera|open (your )?eyes|path blocked|path clear|lookout|watch for|take off|takeoff|cast off|roll out|drone|craft|dog|fish|animal|find the|look for|where is)\b/.test(
      q,
    )
  ) {
    return { kind: "other", raw };
  }

  const saveContact =
    /\b(save|remember|add|store)\b/.test(q) &&
    /\b(contact|number|phone|is)\b/.test(q);
  if (saveContact && (phone || /\bcontact\b/.test(q))) {
    const name =
      place?.replace(/\b(contact|number|phone)\b/g, "").trim() ||
      raw.match(/remember ([a-z][a-z .'-]+)/i)?.[1];
    return {
      kind: "contactSave",
      raw,
      name: name || "Saved",
      phone,
      email: raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0],
    };
  }

  if (/^(contacts|list contacts|who do i know|show contacts)$/.test(q)) {
    return { kind: "contacts", raw };
  }
  if (/^(reservations|my reservations|what did i book|show reservations)$/.test(q)) {
    return { kind: "reservations", raw };
  }

  if (/\b(cancel|scrap|drop|delete) (the |that |my )?(reservation|booking|draft|table)\b/.test(q) || /^cancel that$/.test(q)) {
    return { kind: "cancel", raw, name: "reserve" };
  }

  if (/\bremind me\b/.test(q)) {
    const item =
      after(q, /remind me (?:in \d+(?:\.\d+)? \w+ )?(?:to |that )?(.+)/) ||
      after(q, /remind me (?:at .+? )?(?:to )?(.+)/) ||
      "that";
    return {
      kind: "remind",
      raw,
      item: item.replace(/\b(please|in \d+ \w+)\b/g, "").trim() || "that",
      when: when.at,
      whenLabel: when.label,
    };
  }

  if (/^(what.?s next|next up|what.?s on today|today.?s (agenda|schedule)|agenda)$/.test(q)) {
    return { kind: "next", raw };
  }

  if (/\b(clear (the )?list|empty (the )?list)\b/.test(q)) {
    return { kind: "list", raw, item: "__clear__" };
  }
  if (/\b(check off|got|cross off)\b/.test(q) && /\b(list|grocery|milk|eggs)?/.test(q)) {
    const item =
      after(q, /(?:check off|got|cross off)\s+(.+?)(?:\s+off the list)?$/) || place;
    if (item) return { kind: "list", raw, item, name: "check" };
  }
  if (
    /\b(add .+ to (the )?(list|grocery|shopping))|(grocery|shopping|packing) list\b/.test(q) ||
    /\b(we need|add to the list)\b/.test(q)
  ) {
    const chunk =
      after(q, /(?:add|we need)\s+(.+?)(?:\s+to (?:the )?(?:list|grocery|shopping|packing))?$/) ||
      after(q, /(?:grocery|shopping|packing) list[:\s]+(.+)/) ||
      place;
    return { kind: "list", raw, item: chunk || place, name: "add" };
  }
  if (/^(the )?list$|what.?s on the list|show (the )?list|grocery list/.test(q)) {
    return { kind: "list", raw, name: "show" };
  }

  if (/\b(meeting|appointment|put on (my )?calendar|schedule)\b/.test(q)) {
    const title =
      after(q, /(?:meeting|appointment|schedule|put on (?:my )?calendar)\s+(?:with |for )?(.+)/) ||
      place ||
      "Event";
    return {
      kind: "agenda",
      raw,
      item: title.replace(/\s+(on|at|friday|saturday|sunday|monday|tuesday|wednesday|thursday|tomorrow).*$/, "").trim() || title,
      when: when.at,
      whenLabel: when.label,
    };
  }

  const money = q.match(
    /(\d+(?:\.\d+)?)\s*(usd|eur|gbp|cad|jpy|mxn|dollars?|euros?|pounds?)\s+(?:to|in)\s+(usd|eur|gbp|cad|jpy|mxn|dollars?|euros?|pounds?)/,
  );
  if (money) {
    const alias = (s: string) =>
      /dollar/.test(s) ? "USD" : /euro/.test(s) ? "EUR" : /pound/.test(s) ? "GBP" : s.toUpperCase();
    return {
      kind: "convert",
      raw,
      amount: Number(money[1]),
      from: alias(money[2]),
      to: alias(money[3]),
      name: "money",
    };
  }
  const units = q.match(
    /(\d+(?:\.\d+)?)\s*(miles?|km|kilometers?|meters?|m|feet|ft|inches?|lbs?|pounds?|kg|kilos?|psi|bar|gallons?|liters?|litres?|celsius|fahrenheit|[cf])\s+(?:to|in)\s*(miles?|km|kilometers?|meters?|m|feet|ft|inches?|lbs?|pounds?|kg|kilos?|psi|bar|gallons?|liters?|litres?|celsius|fahrenheit|[cf])/,
  );
  if (units) {
    return {
      kind: "convert",
      raw,
      amount: Number(units[1]),
      from: units[2],
      to: units[3],
      name: "unit",
    };
  }

  const dist = q.match(/how far (?:is |to )(.+?)(?: from (.+))?$/) || q.match(/distance (?:from (.+) )?to (.+)/);
  if (dist && !/iss|jupiter/.test(q)) {
    const to = (dist[1] || dist[2] || "").trim();
    const from = (dist[2] && dist[0].startsWith("how") ? dist[2] : dist[1]) || "";
    if (q.startsWith("how far")) {
      return { kind: "distance", raw, to: dist[1]?.trim(), from: dist[2]?.trim() };
    }
    return { kind: "distance", raw, from: dist[1]?.trim(), to: dist[2]?.trim() };
  }

  if (/\b(i live in|i'm in|im in|set (my )?city|home city)\b/.test(q)) {
    const city =
      q.replace(/.*\b(in|city)\b/, "").replace(/\bi\b.*/, "").trim() || place;
    return { kind: "profile", raw, city };
  }
  if (/\b(my number is|my phone is|set (my )?(number|phone))\b/.test(q) && phone) {
    return { kind: "profile", raw, phone };
  }
  if (/\b(my name is|call me)\b/.test(q)) {
    const name = after(q, /(?:my name is|call me)\s+([a-z][a-z .'-]{1,40})/) || place;
    return { kind: "profile", raw, name };
  }
  if (/\b(default party|party size|we are usually)\b/.test(q) && party) {
    return { kind: "profile", raw, party };
  }

  if (/\b(text|sms|message)\b/.test(q) && (phone || place || /\b(them|him|her|that)\b/.test(q))) {
    const body = raw.match(/(?:text|sms|message)(?: .+?)?(?: that | saying |: )(.+)/i)?.[1];
    return { kind: "sms", raw, phone, name: place, place: place || "them", body };
  }

  if (/\b(hours|open|opening)\b/.test(q) && (place || /\b(them|that)\b/.test(q))) {
    return { kind: "hours", raw, place: place || "them" };
  }

  if (/\b(directions?|navigate|drive to|route to|take me there)\b/.test(q)) {
    return { kind: "directions", raw, place: place || "them" };
  }

  const reserve =
    /\b(book|reserve|reservation|table|four-top|4-top|two-top|get us a|party of)\b/.test(q);
  if (reserve) {
    return {
      kind: "reserve",
      raw,
      place,
      phone,
      party,
      when: when.at,
      whenLabel: when.label,
    };
  }

  if (/\b(call|dial|phone|ring)\b/.test(q)) {
    return { kind: "call", raw, place: place || (/\b(them|him|her|that)\b/.test(q) ? "them" : undefined), phone };
  }

  if (/\bnear(by| me)\b/.test(q) || (cat && /\b(find|where|get)\b/.test(q))) {
    return { kind: "nearby", raw, category: cat || place || "restaurant", place };
  }

  if (/\b(iss|space station|weather|forecast|empty stretch|fieldvault|jupiter|timer|wikipedia)\b/.test(q) && !/\b(book|reserve|call|table)\b/.test(q)) {
    return { kind: "other", raw };
  }

  if (phone && (party || when.at)) {
    return {
      kind: "reserve",
      raw,
      phone,
      place,
      party,
      when: when.at,
      whenLabel: when.label,
    };
  }

  if (phone && !/\b(timer|weather|note)\b/.test(q)) {
    return { kind: "call", raw, phone, place };
  }

  return { kind: "other", raw, place, phone, party };
}
