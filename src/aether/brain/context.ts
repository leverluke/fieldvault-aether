import { findContact, loadLastPlace } from "../memory";
import { getLastFrame } from "../bus";
import { recall, remember } from "./world";

export function rewrite(q: string) {
  const mem = recall();
  const place = mem.place || loadLastPlace()?.name || "";
  const obj = mem.object || getLastFrame()?.objects.find((o) => o.layer !== "bg")?.name || "";
  const who = mem.contact || "";
  let s = q;
  if (place) s = s.replace(/\b(them|that place|there|the restaurant|the place)\b/g, place);
  if (obj) s = s.replace(/\b(that one|that box|that chair|it)\b/g, obj);
  if (who) s = s.replace(/\b(him|her|mom|dad)\b/g, findContact(who)?.name || who);
  return s;
}

export function ingestReply(q: string) {
  const place = loadLastPlace()?.name;
  const o = getLastFrame()?.objects.find((x) => x.layer !== "bg");
  remember({
    entity: place || o?.name || o?.class,
    place,
    object: o?.name || o?.class,
    seek: getLastFrame()?.seek,
  });
}
