export const MAX_PHOTO_DIM = 820;
export const PHOTO_QUALITY = 0.72;

/**
 * Reads an image File, downscales it to fit within `maxDim`, and returns a
 * compressed JPEG data URL. Keeps uploads to ~tens–low-hundreds of KB so photos
 * fit comfortably inside the tree document.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = MAX_PHOTO_DIM,
  quality = PHOTO_QUALITY,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Это не изображение');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Не удалось прочитать файл'));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Не удалось открыть изображение'));
    i.src = dataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(img, 0, 0, width, height);

  const out = canvas.toDataURL('image/jpeg', quality);
  // Safety: if somehow still very large, downscale once more.
  if (out.length > 3_500_000 && maxDim > 480) {
    return fileToCompressedDataUrl(file, Math.round(maxDim * 0.7), quality);
  }
  return out;
}
