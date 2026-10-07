/**
 * Detect image type from magic bytes (do not trust client MIME/filename).
 */
export type DetectedImageType = 'jpeg' | 'png' | 'webp';

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }
  // JPEG FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  // PNG 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export const ALLOWED_UPLOAD_IMAGE_EXT: Record<DetectedImageType, string> = {
  jpeg: '.jpeg',
  png: '.png',
  webp: '.webp',
};

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
