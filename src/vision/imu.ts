/** Phone compass / gyro to help SLAM yaw. */

let yaw = 0;
let lastAlpha: number | null = null;
let hooked = false;

function onOrient(e: DeviceOrientationEvent) {
  if (e.alpha == null) return;
  if (lastAlpha == null) {
    lastAlpha = e.alpha;
    return;
  }
  let d = e.alpha - lastAlpha;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  lastAlpha = e.alpha;
  yaw = (d * Math.PI) / 180;
}

export function startImu() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("deviceorientation", onOrient);
}

export function imuYaw() {
  const v = yaw;
  yaw *= 0.4;
  return v;
}

export function resetImu() {
  lastAlpha = null;
  yaw = 0;
}
