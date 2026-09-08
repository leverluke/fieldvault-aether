/** Compact QR (byte mode, ECC M) for short truck-handoff strings. */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number) {
  if (!a || !b) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(ec: number) {
  let poly = [1];
  for (let i = 0; i < ec; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ec: number) {
  const gen = rsGenerator(ec);
  const res = new Array(ec).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift();
    res.push(0);
    if (!factor) continue;
    for (let i = 0; i < gen.length - 1; i++) {
      res[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return res;
}

const VERSIONS: Array<{ v: number; size: number; data: number; ec: number }> = [
  { v: 2, size: 25, data: 32, ec: 16 },
  { v: 4, size: 33, data: 62, ec: 26 },
  { v: 6, size: 41, data: 108, ec: 36 },
];

function bitsToBytes(bits: string) {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(parseInt(bits.slice(i, i + 8).padEnd(8, "0"), 2));
  }
  return out;
}

function encodeData(text: string, cap: number) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let bits = "0100" + bytes.length.toString(2).padStart(8, "0");
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  bits += "0000";
  const need = cap * 8;
  if (bits.length > need) return null;
  bits = bits.padEnd(Math.min(need, Math.ceil(bits.length / 8) * 8), "0");
  const data = bitsToBytes(bits);
  const pad = [0xec, 0x11];
  let p = 0;
  while (data.length < cap) data.push(pad[p++ % 2]);
  return data;
}

function reserved(size: number) {
  const r = Array.from({ length: size }, () => Array(size).fill(false));
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < size && y < size) r[y][x] = true;
  };
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) mark(ox + x, oy + y);
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  const align = size === 25 ? [18] : size === 33 ? [26] : size === 41 ? [34] : size === 49 ? [42] : [50];
  for (const a of align) {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) mark(a + x, a + y);
  }
  for (let i = 0; i < 9; i++) {
    mark(8, i);
    mark(i, 8);
    mark(8, size - 1 - i);
    mark(size - 1 - i, 8);
  }
  mark(8, 8);
  return r;
}

function placeFinders(mod: boolean[][], size: number) {
  const draw = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const mid = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        mod[oy + y][ox + x] = edge || mid;
      }
    }
  };
  draw(0, 0);
  draw(size - 7, 0);
  draw(0, size - 7);
  for (let i = 0; i < size; i++) {
    if (i % 2 === 0) {
      mod[6][i] = true;
      mod[i][6] = true;
    }
  }
  const a = size === 25 ? 18 : size === 33 ? 26 : size === 41 ? 34 : size === 49 ? 42 : 50;
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const edge = Math.abs(x) === 2 || Math.abs(y) === 2;
      mod[a + y][a + x] = edge || (x === 0 && y === 0);
    }
  }
}

function applyMask(mod: boolean[][], res: boolean[][], size: number) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (res[y][x]) continue;
      if ((x + y) % 2 === 0) mod[y][x] = !mod[y][x];
    }
  }
}

function formatBits(mod: boolean[][], size: number) {
  // ECC M (00) + mask 0 (000) → format 0b00000, BCH 0x5412 family. Hardcoded mask 0 / M.
  const bits = "101010000010010";
  const coords: Array<[number, number]> = [];
  for (let i = 0; i <= 5; i++) coords.push([8, i]);
  coords.push([8, 7], [8, 8], [7, 8]);
  for (let i = 5; i >= 0; i--) coords.push([i, 8]);
  bits.split("").forEach((b, i) => {
    const [x, y] = coords[i];
    mod[y][x] = b === "1";
  });
  bits.split("").forEach((b, i) => {
    if (i < 8) mod[size - 1 - i][8] = b === "1";
    else mod[8][size - 15 + i] = b === "1";
  });
  mod[size - 8][8] = true;
}

function placeData(mod: boolean[][], res: boolean[][], data: number[], size: number) {
  const bits = data.map((b) => b.toString(2).padStart(8, "0")).join("");
  let i = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let n = 0; n < size; n++) {
      const y = up ? size - 1 - n : n;
      for (const x of [col, col - 1]) {
        if (res[y][x]) continue;
        mod[y][x] = bits[i] === "1";
        i++;
      }
    }
    up = !up;
  }
}

export function qrMatrix(text: string): boolean[][] {
  const raw = String(text || "").slice(0, 200);
  let picked = VERSIONS[VERSIONS.length - 1];
  let data: number[] | null = null;
  for (const v of VERSIONS) {
    const enc = encodeData(raw, v.data);
    if (enc) {
      picked = v;
      data = enc;
      break;
    }
  }
  if (!data) data = encodeData(raw.slice(0, 80), picked.data) || encodeData("FV", picked.data)!;
  const ecc = rsEncode(data, picked.ec);
  const size = picked.size;
  const mod = Array.from({ length: size }, () => Array(size).fill(false));
  const res = reserved(size);
  placeFinders(mod, size);
  placeData(mod, res, data.concat(ecc), size);
  applyMask(mod, res, size);
  formatBits(mod, size);
  return mod;
}

export function qrSvg(text: string, scale = 6) {
  const m = qrMatrix(text);
  const n = m.length;
  const pad = 4;
  const dim = (n + pad * 2) * scale;
  let rects = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) {
        rects += `<rect x="${(x + pad) * scale}" y="${(y + pad) * scale}" width="${scale}" height="${scale}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/>${rects}</svg>`;
}

export function qrDataUrl(text: string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg(text));
}
