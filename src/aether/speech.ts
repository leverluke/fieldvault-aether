export function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const prefer = [
    "Google UK English Male",
    "Daniel",
    "Microsoft George",
    "Microsoft Ryan",
    "British",
    "en-GB",
  ];
  for (const name of prefer) {
    const v = voices.find(
      (x) =>
        (x.name.includes(name) || x.lang.toLowerCase().includes(name.toLowerCase())) &&
        x.lang.toLowerCase().startsWith("en"),
    );
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("en-gb")) ||
    voices.find((v) => v.lang.startsWith("en") && /male/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("en") && !/compact|eloquence/i.test(v.name)) ||
    voices[0] ||
    null
  );
}

function chunks(text: string) {
  return text
    .replace(/\n+/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length > 1);
}

import { quietHours } from "./log";

export function speak(text: string, muted: boolean) {
  if (muted || quietHours() || typeof window === "undefined" || !window.speechSynthesis) return;
  document.querySelectorAll("audio, video").forEach((el) => {
    const media = el as HTMLMediaElement;
    if (!media.paused && media.srcObject == null) {
      try {
        media.pause();
      } catch {
        /* ignore */
      }
    }
  });
  if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const voice = pickVoice();
  const parts = chunks(text).slice(0, 6);
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.rate = 0.9;
    u.pitch = 0.78;
    u.volume = 1;
    if (voice) u.voice = voice;
    u.lang = voice?.lang || "en-GB";
    if (i > 0) u.rate = 0.88;
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

type Recog = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function makeRecognizer(opts?: { continuous?: boolean }): Recog | null {
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => Recog }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => Recog })
      .webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = Boolean(opts?.continuous);
  return rec;
}

export function stripWake(text: string) {
  return text.replace(/^(hey |ok |okay |hi )?(aether|ae)\b[,\s.]*/i, "").trim();
}

export function hasWake(text: string) {
  return /\b(hey |ok |okay )?(aether|ae)\b/i.test(text);
}
