import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GridFSBucket, ObjectId } from 'mongodb';
import { getMongoDB } from '../../config/mongodb.js';

// Private staging for original import files. Bytes are immutable once staged;
// replacing a file in a batch stages a new object and deletes the old one.
const bucket = () => new GridFSBucket(getMongoDB(), { bucketName: 'questionImportFiles' });
const toId = id => (id instanceof ObjectId ? id : new ObjectId(String(id)));

export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

export async function stageFile(buffer, { filename, jobId }) {
  const digest = sha256(buffer);
  const upload = bucket().openUploadStream(filename, { metadata: { jobId, sha256: digest, contentType: 'application/x-ndjson' } });
  await pipeline(Readable.from([buffer]), upload);
  return { gridFsId: String(upload.id), sha256: digest };
}

export const openStagedStream = gridFsId => bucket().openDownloadStream(toId(gridFsId));

export async function deleteStagedFile(gridFsId) {
  if (!gridFsId) return;
  try { await bucket().delete(toId(gridFsId)); }
  catch (error) { if (!/FileNotFound|not found/i.test(String(error?.message))) throw error; }
}
