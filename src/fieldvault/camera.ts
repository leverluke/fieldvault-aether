let stream: MediaStream | null = null;

export async function startFieldCamera(video: HTMLVideoElement): Promise<MediaStream> {
  stopFieldCamera();
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1440 },
    },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();
  return stream;
}

export function stopFieldCamera() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }
  stream = null;
}

export function cameraLive() {
  return !!(stream && stream.getVideoTracks().some((t) => t.readyState === "live"));
}

export function cameraTrack() {
  return stream?.getVideoTracks()[0] ?? null;
}

export function torchSupported() {
  const track = cameraTrack();
  const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
  return !!caps?.torch;
}

export async function setTorch(on: boolean) {
  const track = cameraTrack();
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] } as unknown as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}

export async function grabFrame(video: HTMLVideoElement): Promise<File> {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 960;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("frame"))), "image/jpeg", 0.82);
  });
  return new File([blob], `fv-${Date.now()}.jpg`, { type: "image/jpeg" });
}
