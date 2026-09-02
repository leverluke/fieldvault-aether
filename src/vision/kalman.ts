/** 1D constant-velocity Kalman for box center / size. */

export type KH = {
  x: number;
  v: number;
  p00: number;
  p01: number;
  p10: number;
  p11: number;
};

export function kh(x = 0, v = 0): KH {
  return { x, v, p00: 0.4, p01: 0, p10: 0, p11: 0.4 };
}

export function khPredict(k: KH, dt: number, q = 0.05) {
  k.x += k.v * dt;
  const p00 = k.p00 + dt * (k.p10 + k.p01) + dt * dt * k.p11 + q;
  const p01 = k.p01 + dt * k.p11;
  const p10 = k.p10 + dt * k.p11;
  const p11 = k.p11 + q * 0.35;
  k.p00 = p00;
  k.p01 = p01;
  k.p10 = p10;
  k.p11 = p11;
}

export function khUpdate(k: KH, z: number, r = 0.035) {
  const y = z - k.x;
  const s = k.p00 + r;
  const k0 = k.p00 / s;
  const k1 = k.p10 / s;
  k.x += k0 * y;
  k.v += k1 * y;
  const p00 = (1 - k0) * k.p00;
  const p01 = (1 - k0) * k.p01;
  const p10 = k.p10 - k1 * k.p00;
  const p11 = k.p11 - k1 * k.p01;
  k.p00 = p00;
  k.p01 = p01;
  k.p10 = p10;
  k.p11 = p11;
}
