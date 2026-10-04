import { expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeImage } from '../validatedImage.js';
import { validateTutorAttachment } from '../tutorAttachment.js';
const create = (width = 10, height = 10) => sharp({ create: { width, height, channels: 3, background: '#123456' } });
it('decodes real images, shrinks dimensions and strips input EXIF metadata', async () => {
  const input = await create(2100, 10).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const metadata = await sharp(await normalizeImage(input)).metadata();
  expect(metadata.format).toBe('webp');
  expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(2000);
  expect(metadata.exif).toBeUndefined();
});
it.each(['png', 'jpeg', 'webp'])('accepts actual %s content', async format => {
  expect((await sharp(await normalizeImage(await create().toFormat(format).toBuffer())).metadata()).format).toBe('webp');
});
it('rejects spoofed files, GIF/SVG, truncated images, dimensions and pixel bombs', async () => {
  const animated = await sharp([await create().png().toBuffer(), await create().negate().png().toBuffer()], { join: { animated: true } }).webp().toBuffer();
  for (const input of [Buffer.from('not an image'), Buffer.from('<svg width="10" height="10"/>'), await create().gif().toBuffer(), animated, (await create().png().toBuffer()).subarray(0, 30), await create(6001, 1).png().toBuffer(), await create(1, 6001).png().toBuffer(), await create(5001, 5000).png().toBuffer()]) {
    await expect(normalizeImage(input)).rejects.toMatchObject({ statusCode: 400 });
  }
});
it('validates Tutor signatures, canonicalizes MIME and enforces bytes', async () => {
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  expect((await validateTutorAttachment({ buffer: pdf, originalname: 'x', mimetype: 'image/png' })).mimetype).toBe('application/pdf');
  expect((await validateTutorAttachment({ buffer: await create().png().toBuffer(), originalname: 'x', mimetype: 'text/plain' })).mimetype).toBe('image/webp');
  await expect(validateTutorAttachment({ buffer: Buffer.from('%PDF-1.7 missing trailer'), originalname: 'x' })).rejects.toMatchObject({ statusCode: 400 });
  await expect(validateTutorAttachment({ buffer: Buffer.alloc(8 * 1024 * 1024 + 1), originalname: 'x' })).rejects.toMatchObject({ statusCode: 413 });
  await expect(validateTutorAttachment({ buffer: Buffer.alloc(0), originalname: 'x' })).rejects.toMatchObject({ statusCode: 413 });
});
