/** YAMNet if the graph loads; otherwise a 3-band energy guess. */

const LABELS = ["speech", "engine", "splash", "glass", "bark", "music", "silence"];

let last = { label: "silence", score: 0 };

export function bandGuess(buf: Uint8Array) {
  let lo = 0;
  let mid = 0;
  let hi = 0;
  const n = buf.length;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(buf[i] - 128) / 128;
    if (i < n * 0.15) lo += v;
    else if (i < n * 0.55) mid += v;
    else hi += v;
  }
  lo /= n * 0.15;
  mid /= n * 0.4;
  hi /= n * 0.45;
  const sum = lo + mid + hi + 1e-6;
  let label = "silence";
  let score = Math.max(lo, mid, hi);
  if (score < 0.04) label = "silence";
  else if (hi > lo && hi > mid && hi > 0.12) label = "glass";
  else if (lo > mid && lo > 0.1) label = "engine";
  else if (mid > 0.08 && hi > 0.06) label = "speech";
  else if (mid > 0.1) label = "bark";
  else label = "splash";
  last = { label, score: Math.min(1, score / sum) };
  return last;
}

export function lastSound() {
  return last;
}

export function yamnetNote() {
  return "Audio events are a 3-band guess until YAMNet weights sit in /models.";
}
