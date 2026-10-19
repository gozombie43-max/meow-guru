import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import sharp from 'sharp';
import { loadSafeZip, IMAGE_INPUT_OPTIONS } from '../uploads/safeZip.js';
import { fetchAdminPaperQuestions, saveAdminPaperQuestions } from './adminPaperEditor.js';
import { putObject, deleteObject, stableImageUrl } from '../../infrastructure/objectStorage.js';
import { logger } from '../../infrastructure/logger.js';

const fail = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });
const mapping = z.object({
  questionId: z.string().min(1), file: z.string().regex(/^images\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/),
  target: z.enum(['question', 'option']), option: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).optional(),
  language: z.enum(['en', 'bn']).optional(),
}).strict().superRefine((row, context) => {
  if (row.target === 'option' && (!row.option || !row.language)) context.addIssue({ code: 'custom', message: 'Option images require option and language' });
  if (row.target === 'question' && (row.option || row.language)) context.addIssue({ code: 'custom', message: 'Question images are shared across languages; omit option and language' });
});
const manifestSchema = z.object({ version: z.literal(1), examSlug: z.string(), paperId: z.string(), images: z.array(mapping).min(1).max(500) }).strict();

export async function importPaperImageZip({ buffer, examSlug, slotId, examMode, expectedUpdatedAt, validateOnly }) {
  const paper = await fetchAdminPaperQuestions(examSlug, slotId, examMode);
  if (paper.updatedAt !== expectedUpdatedAt) throw fail('Paper changed. Reload the paper and validate the ZIP again.', 409);
  let zip;
  try { zip = await loadSafeZip(buffer); }
  catch (error) { throw fail(`ZIP rejected: ${error.message}. Use a standard, unencrypted ZIP within the documented limits.`, error.statusCode || 422); }
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw fail('Missing manifest.json at ZIP root. Download the format guide and add the manifest.');
  const manifestBytes = await manifestFile.async('nodebuffer');
  if (manifestBytes.length > 128 * 1024) throw fail('manifest.json exceeds 128 KiB. Split this upload.');
  let parsed;
  try { parsed = JSON.parse(manifestBytes.toString('utf8')); }
  catch { throw fail('manifest.json is not valid JSON. Remove trailing commas and use double quotes.'); }
  const result = manifestSchema.safeParse(parsed);
  if (!result.success) throw fail(`Invalid manifest: ${result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  const manifest = result.data;
  if (manifest.examSlug !== examSlug || manifest.paperId !== slotId) throw fail('Manifest paperId/examSlug does not match this paper. Open the correct paper or fix the manifest.');
  const referenced = new Set(manifest.images.map(row => row.file));
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (entry.name !== 'manifest.json' && !referenced.has(entry.name)) throw fail(`Unexpected file: ${entry.name}. Remove unused files, nested ZIPs and system metadata.`);
    if (entry.unixPermissions && (Number(entry.unixPermissions) & 0o170000) === 0o120000) throw fail(`Symbolic links are forbidden: ${entry.name}`);
  }
  const byId = new Map(paper.questions.map(q => [q.id, q]));
  const edits = new Map();
  const targets = new Set();
  const converted = new Map();
  const summary = [];
  for (const row of manifest.images) {
    const question = byId.get(row.questionId);
    if (!question) throw fail(`Unknown question ID ${row.questionId}. Use the ID shown in this paper, not its display number.`);
    const target = `${row.questionId}:${row.target}:${row.language || ''}:${row.option || ''}`;
    if (targets.has(target)) throw fail(`Duplicate target ${target}. Keep one image per target.`);
    targets.add(target);
    const index = 'ABCDEFGH'.indexOf(row.option);
    const text = row.language === 'bn' ? question.translations?.bn : question;
    if (row.target === 'option' && (!text || index >= text.options.length || question.questionType === 'NAT')) throw fail(`Question ${row.questionId}: option ${row.option}/${row.language} does not exist. Use an existing option and language.`);
    const entry = zip.file(row.file);
    if (!entry) throw fail(`Missing image ${row.file}. File names are case sensitive.`);
    if (!converted.has(row.file)) {
      try {
        const bytes = await entry.async('nodebuffer');
        const image = sharp(bytes, IMAGE_INPUT_OPTIONS);
        const metadata = await image.metadata();
        const extension = row.file.split('.').at(-1);
        if (!['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1 || (extension === 'jpg' ? 'jpeg' : extension) !== metadata.format) throw new Error('Use a static PNG, JPEG or WebP whose extension matches its content');
        converted.set(row.file, await image.rotate().webp({ quality: 90 }).toBuffer());
      } catch (error) { throw fail(`${row.file}: cannot decode image. ${error.message}. Re-export a static PNG/JPEG/WebP under 8 MiB and 16 million pixels.`); }
    }
    if (!edits.has(question.id)) {
      const { sectionKey: _section, questionType: _type, ...edit } = structuredClone(question);
      edits.set(question.id, edit);
    }
    summary.push({ questionId: row.questionId, target: row.target, option: row.option, language: row.language, file: row.file,
      replaces: row.target === 'question' ? Boolean(question.questionImage) : true });
  }
  const buildEdits = urls => {
    const next = structuredClone([...edits.values()]);
    const byQuestion = new Map(next.map(edit => [edit.id, edit]));
    for (const row of manifest.images) {
      const edit = byQuestion.get(row.questionId);
      if (row.target === 'question') edit.questionImage = urls.get(row.file);
      else {
        const text = row.language === 'bn' ? edit.translations.bn : edit;
        text.options['ABCDEFGH'.indexOf(row.option)] = `![Option ${row.option}](${urls.get(row.file)})`;
      }
    }
    return next;
  };
  const input = urls => ({ expectedUpdatedAt, edits: buildEdits(urls) });
  const replaceOptionImages = manifest.images.filter(row => row.target === 'option').map(row => ({ id: row.questionId, index: 'ABCDEFGH'.indexOf(row.option) }));
  await saveAdminPaperQuestions(examSlug, slotId, examMode, input(new Map([...converted.keys()].map(file => [file, '/api/upload/image/validation']))), { validateOnly: true, replaceOptionImages });
  if (validateOnly) return { valid: true, images: summary, questionCount: edits.size, fileCount: converted.size };
  const prefix = `question-images/paper-imports/${randomUUID()}`;
  const attempted = [];
  const urls = new Map();
  let saving = false;
  try {
    for (const [file, bytes] of converted) {
      const key = `${prefix}/${attempted.length}.webp`;
      attempted.push(key);
      await putObject(key, bytes, 'image/webp');
      urls.set(file, stableImageUrl(key));
    }
    saving = true;
    const saved = await saveAdminPaperQuestions(examSlug, slotId, examMode, input(urls), { replaceOptionImages });
    return { ...saved, fileCount: converted.size, images: summary };
  } catch (error) {
    // An unknown database outcome may already reference these objects. Keep them
    // available until an operator can reconcile; never delete a possibly linked image.
    if (!saving || error.statusCode) await Promise.all(attempted.map(key => deleteObject(key).catch(err => logger.error({ err, key }, 'paper ZIP cleanup failed'))));
    else logger.error({ err: error, keys: attempted }, 'paper ZIP save outcome unknown; reconcile objects before cleanup');
    if (error.statusCode) throw error;
    throw fail(saving ? 'Save outcome could not be confirmed. Reload the paper to check images before retrying; report this to an administrator.' : 'B2 upload failed. No paper changes were saved. Retry the ZIP; if it repeats, ask an administrator to check B2 connectivity and credentials.', 503);
  }
}
