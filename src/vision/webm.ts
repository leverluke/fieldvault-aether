let rec: MediaRecorder | null = null;
let chunks: Blob[] = [];

export function startWebm(canvas: HTMLCanvasElement) {
  const stream = canvas.captureStream(12);
  rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
  chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(800);
}

export function stopWebm() {
  return new Promise<Blob | null>((resolve) => {
    if (!rec) {
      resolve(null);
      return;
    }
    rec.onstop = () => {
      resolve(new Blob(chunks, { type: "video/webm" }));
      rec = null;
    };
    rec.stop();
  });
}

export function downloadWebm(blob: Blob, vtt?: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "aether-run.webm";
  a.click();
  if (vtt) {
    const b = document.createElement("a");
    b.href = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
    b.download = "aether-run.vtt";
    b.click();
  }
}
