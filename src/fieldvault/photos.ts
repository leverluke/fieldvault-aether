export type ExifFix = { lat: number; lng: number; acc?: number };

export type IngestedPhoto = {
  blob: Blob;
  mime: string;
  dark: boolean;
  exif?: ExifFix;
};

function isHeic(file: File) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

async function readExif(file: Blob): Promise<ExifFix | undefined> {
  try {
    const exifr = await import("exifr");
    const gps = await exifr.gps(file);
    if (!gps || !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) return undefined;
    return { lat: gps.latitude, lng: gps.longitude };
  } catch {
    return undefined;
  }
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.82 });
  return Array.isArray(out) ? out[0] : out;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head || "")?.[1] || "image/jpeg";
  const bin = atob(body || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function compressToJpegBlob(source: CanvasImageSource, quality = 0.72, maxDim = 1600): Blob {
  const w0 = "naturalWidth" in source ? Number(source.naturalWidth) : Number((source as HTMLCanvasElement).width || 0);
  const h0 = "naturalHeight" in source ? Number(source.naturalHeight) : Number((source as HTMLCanvasElement).height || 0);
  let w = w0 || 1600;
  let h = h0 || 1200;
  if (w > maxDim || h > maxDim) {
    const r = Math.min(maxDim / w, maxDim / h);
    w = Math.max(1, Math.floor(w * r));
    h = Math.max(1, Math.floor(h * r));
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return new Blob();
  ctx.drawImage(source, 0, 0, w, h);
  const url = c.toDataURL("image/jpeg", quality);
  return dataUrlToBlob(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

function isDarkFromImage(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return sum / (d.length / 4) < 50;
}

export async function ingestPhotoFile(file: File, opts?: { quality?: number; maxDim?: number }): Promise<IngestedPhoto> {
  const exif = await readExif(file);
  let working: Blob = file;
  if (isHeic(file)) {
    try {
      working = await heicToJpeg(file);
    } catch {
      working = file;
    }
  }
  const url = URL.createObjectURL(working);
  try {
    const img = await loadImage(url);
    const blob = compressToJpegBlob(img, opts?.quality ?? 0.72, opts?.maxDim ?? 1600);
    return { blob, mime: "image/jpeg", dark: isDarkFromImage(img), exif };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canvasJpegBlob(draw: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => void): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 400;
  const ctx = c.getContext("2d");
  if (!ctx) return new Blob();
  draw(ctx, c);
  return dataUrlToBlob(c.toDataURL("image/jpeg", 0.72));
}
