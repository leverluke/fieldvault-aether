import { setSeek } from "@/vision/detector";
import { setNavTarget } from "@/vision/waypoints";

let watch: number | null = null;
let last: { lat: number; lon: number } | null = null;

export function startFollowMe() {
  setSeek("person");
  if (!navigator.geolocation) return false;
  if (watch != null) return true;
  watch = navigator.geolocation.watchPosition(
    (p) => {
      const lat = p.coords.latitude;
      const lon = p.coords.longitude;
      if (last) {
        const dx = (lon - last.lon) * 111320 * Math.cos((lat * Math.PI) / 180);
        const dy = (lat - last.lat) * 110540;
        setNavTarget(dx * 0.02, dy * 0.02, "follow-me");
      }
      last = { lat, lon };
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 800 },
  );
  return true;
}

export function stopFollowMe() {
  if (watch != null) navigator.geolocation.clearWatch(watch);
  watch = null;
  last = null;
}
