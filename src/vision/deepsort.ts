/** Cosine metric learning + ByteTrack thresholds. Appearance is MobileNet crops. */

export const BYTE_HIGH = 0.38;
export const BYTE_LOW = 0.08;

export function cosine(a?: ArrayLike<number> | null, b?: ArrayLike<number> | null) {
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den ? d / den : 0;
}

export function l2(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  const s = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
  return out;
}

export function blendApp(prev: Float32Array | undefined, next: Float32Array, a = 0.18): Float32Array {
  if (!prev || prev.length !== next.length) return l2(next);
  const out = new Float32Array(next.length);
  for (let i = 0; i < next.length; i++) out[i] = prev[i] * (1 - a) + next[i] * a;
  return l2(out);
}

export function appCost(trackApp?: Float32Array, detApp?: Float32Array) {
  if (!trackApp || !detApp) return 0.5;
  return 1 - cosine(trackApp, detApp);
}

export function pushGallery(g: Float32Array[] | undefined, v: Float32Array, cap = 12): Float32Array[] {
  const next = l2(v);
  const out = g ? g.slice() : [];
  if (out.some((p) => cosine(p, next) > 0.985)) return out;
  out.push(next);
  if (out.length > cap) out.shift();
  return out;
}

export function galleryLook(g?: Float32Array[], det?: Float32Array) {
  if (!g?.length || !det) return 0;
  let best = 0;
  for (const v of g) best = Math.max(best, cosine(v, det));
  return best;
}

/** Pull toward own gallery, push away from other IDs (online cosine metric). */
export function metricLook(
  self?: Float32Array[],
  det?: Float32Array,
  others?: (Float32Array[] | undefined)[],
) {
  const pos = galleryLook(self, det);
  if (!det) return 0;
  if (!others?.length) return pos;
  let neg = 0;
  for (const o of others) {
    if (!o?.length) continue;
    neg = Math.max(neg, galleryLook(o, det));
  }
  return pos - 0.5 * Math.max(0, neg - pos + 0.04);
}
