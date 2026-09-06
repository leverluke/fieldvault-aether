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

export function bindWalkWake() {
  if (typeof document === "undefined") return;
  if (document.documentElement.dataset.fvWake === "1") return;
  document.documentElement.dataset.fvWake = "1";
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void requestWalkWake();
  });
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
