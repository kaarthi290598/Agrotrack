/** Knock out paper-white so a scanned signature blends on the invoice. */

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 900;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png"]);

function assertSignatureFile(file: File): void {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const okType = ALLOWED.has(type) || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
  if (!okType) {
    throw new Error("Signature must be a JPG or PNG file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Signature must be 2 MB or smaller.");
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the signature image."));
    };
    img.src = url;
  });
}

function blendPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Near-white / paper: fully transparent
    if (luminance > 242 && max - min < 28) {
      data[i + 3] = 0;
      continue;
    }
    // Soft fade on pale paper edges
    if (luminance > 210) {
      const t = (luminance - 210) / 32;
      data[i + 3] = Math.round(a * (1 - t));
    }
  }
}

export async function blendSignatureFile(file: File): Promise<File> {
  assertSignatureFile(file);
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not process the signature image.");

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  blendPixels(image.data);
  ctx.putImageData(image, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Could not blend signature."))),
      "image/png"
    );
  });

  return new File([blob], "signature.png", { type: "image/png" });
}
