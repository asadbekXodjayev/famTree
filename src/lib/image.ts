export { MAX_PHOTOS } from './types';

export const MAX_PHOTO_DIM = 820;
export const PHOTO_QUALITY = 0.72;
/** Largest file we will accept from the picker, before compression. */
export const MAX_PHOTO_FILE_BYTES = 20 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
}

/**
 * Reads an image File, downscales it to fit within `maxDim`, and returns a
 * compressed JPEG data URL. Keeps uploads to ~tens–low-hundreds of KB so photos
 * fit comfortably inside the tree document.
 *
 * Files above `MAX_PHOTO_FILE_BYTES` are rejected before any read: decoding a
 * huge image costs width*height*4 bytes of canvas memory and can hang or crash
 * the tab, so the guard has to come first.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = MAX_PHOTO_DIM,
  quality = PHOTO_QUALITY,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Это не изображение');
  }
  if (file.size > MAX_PHOTO_FILE_BYTES) {
    throw new Error(
      `Файл слишком большой (${formatBytes(file.size)}). Максимум — ${formatBytes(MAX_PHOTO_FILE_BYTES)}.`,
    );
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
