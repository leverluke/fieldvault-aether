export function registerFieldVaultPwa() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (/localhost|127\.0\.0\.1/.test(host)) return;
  void navigator.serviceWorker.register("/fv-sw.js").catch(() => {});
}

export function canInstallPwa() {
  return typeof window !== "undefined" && !!(window as Window & { __fvInstall?: Event }).__fvInstall;
}

export async function promptInstallPwa() {
  const ev = (window as Window & { __fvInstall?: BeforeInstallPromptEvent }).__fvInstall;
  if (!ev) return false;
  await ev.prompt();
  const choice = await ev.userChoice;
  (window as Window & { __fvInstall?: BeforeInstallPromptEvent }).__fvInstall = undefined;
  return choice.outcome === "accepted";
}

export function bindInstallCapture() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    (window as Window & { __fvInstall?: Event }).__fvInstall = e;
  });
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
