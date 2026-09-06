let sentinel: WakeLockSentinel | null = null;
let onRelease: (() => void) | null = null;

export async function requestWalkWake() {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    onRelease = () => {
      sentinel = null;
    };
    sentinel.addEventListener("release", onRelease);
  } catch {
    sentinel = null;
  }
}

export async function releaseWalkWake() {
  try {
    if (sentinel) {
      if (onRelease) sentinel.removeEventListener("release", onRelease);
      await sentinel.release();
    }
  } catch {
    /* ignore */
  }
  sentinel = null;
  onRelease = null;
}
