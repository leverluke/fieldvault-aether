import { bandGuess } from "./yamnet";

let ctx: AudioContext | null = null;
let last = 0;
let spike = 0;

export function startAudioWatch(stream: MediaStream) {
  try {
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!ctx) return;
      an.getByteTimeDomainData(buf);
      bandGuess(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        s += v * v;
      }
      const rms = Math.sqrt(s / buf.length);
      if (rms > 0.22) {
        spike = Date.now();
        last = rms;
      }
      requestAnimationFrame(tick);
    };
    tick();
  } catch {
    /* no mic graph */
  }
}

export function stopAudioWatch() {
  void ctx?.close();
  ctx = null;
}

export function lastSpike() {
  if (Date.now() - spike > 2500) return 0;
  return last;
}
