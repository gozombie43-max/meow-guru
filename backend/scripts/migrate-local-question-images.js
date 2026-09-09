import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { putObject, getObject, stableImageUrl } from '../infrastructure/objectStorage.js';
import { legacyImageFilenames, replaceLegacyImages } from '../migrations/legacyImageReferences.js';

const apply = process.argv.includes('--apply');
const uploads = fileURLToPath(new URL('../uploads/', import.meta.url));
const fields = ['question', 'questionText', 'options', 'solution', 'solutionText', 'questionImage', 'solutionImage'];
const stats = { apply, records: 0, assets: 0, modified: 0, conflicted: 0, missing: 0, unresolved: 0 };
const migrated = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const db = await connectMongoDB();
  const questions = db.collection('questions');
  const filter = { $or: fields.map(field => ({ [field]: /\/uploads\// })) };
  for await (const row of questions.find(filter)) {
    stats.records++;
    const updates = {};
    const guards = { _id: row._id };
    async function rewrite(value) {
      if (Array.isArray(value)) { const items = []; for (const item of value) items.push(await rewrite(item)); return items; }
      if (typeof value !== 'string') return value;
      for (const filename of legacyImageFilenames(value)) {
        if (filename === '.' || filename === '..') throw new Error('Invalid image filename');
        if (!migrated.has(filename)) {
          const resolved = path.resolve(uploads, filename);
          if (path.dirname(resolved) !== path.resolve(uploads)) throw new Error('Image path escapes uploads');
          let bytes;
          try { bytes = await readFile(resolved); }
          catch (error) { if (error.code !== 'ENOENT') throw error; stats.missing++; continue; }
          const key = `question-images/legacy/${hash(bytes)}${path.extname(filename).toLowerCase()}`;
          if (apply) {
            const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
            await putObject(key, bytes, types[path.extname(filename).toLowerCase()] || 'application/octet-stream');
            if (hash(await getObject(key)) !== hash(bytes)) throw new Error('Uploaded image verification failed');
          }
          migrated.set(filename, stableImageUrl(key));
          stats.assets++;
        }
      }
      const rewritten = replaceLegacyImages(value, migrated);
      if (rewritten.includes('/uploads/')) stats.unresolved++;
      return rewritten;
    }
    for (const field of fields) {
      if (!Object.hasOwn(row, field)) continue;
      const value = await rewrite(row[field]);
      if (JSON.stringify(value) !== JSON.stringify(row[field])) { updates[field] = value; guards[field] = { $eq: row[field] }; }
    }
    if (apply && Object.keys(updates).length) {
      const result = await questions.updateOne(guards, { $set: updates });
      stats.modified += result.modifiedCount;
      stats.conflicted += 1 - result.matchedCount;
    }
  }
  console.log(JSON.stringify(stats));
  if (stats.missing || stats.conflicted || stats.unresolved) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await disconnectMongoDB(); }
