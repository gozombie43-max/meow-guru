// @ts-check
import sharp from 'sharp';

export const MAX_IMAGE_PIXELS = 25_000_000;
export const MAX_IMAGE_DIMENSION = 6000;
const allowedFormats = new Set(['jpeg', 'png', 'webp']);

/** Decode untrusted bytes and strip metadata by re-encoding. Client MIME is never used.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function normalizeImage(buffer) {
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!metadata.format || !allowedFormats.has(metadata.format) || (metadata.pages || 1) !== 1) throw new Error('Unsupported image');
    if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) throw new Error('Image dimensions exceeded');
    return await image.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw Object.assign(new Error('Provide a valid, non-animated JPG, PNG or WebP image, up to 6000 pixels per side and 25 megapixels.'), { statusCode: 400 });
  }
}
