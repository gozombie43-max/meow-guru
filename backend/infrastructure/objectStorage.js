import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, ListObjectVersionsCommand } from '@aws-sdk/client-s3';
import { objectStorage, retryRead } from './dependencyBoundary.js';

export async function putObject(key, body, contentType) {
  const { b2Client, B2_BUCKET } = await import('../config/b2.js');
  await objectStorage.execute(signal => b2Client.send(new PutObjectCommand({ Bucket: B2_BUCKET, Key: key, Body: body, ContentLength: body.length, ContentType: contentType }), { abortSignal: signal }));
}
export async function getObject(key) {
  const { b2Client, B2_BUCKET } = await import('../config/b2.js');
  return retryRead(objectStorage, async signal => {
    const response = await b2Client.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: key }), { abortSignal: signal });
    return Buffer.from(await response.Body.transformToByteArray());
  });
}
export async function deleteObject(key) {
  const { b2Client, B2_BUCKET } = await import('../config/b2.js');
  await objectStorage.execute(signal => b2Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key }), { abortSignal: signal }));
}

export async function purgeObjectVersions(key) {
  if (typeof key !== 'string' || !/^(?:notes\/images\/|tutor-jobs\/)[A-Za-z0-9_./-]+$/.test(key) || key.includes('..')) {
    throw new Error('Invalid cleanup object key');
  }
  const { b2Client, B2_BUCKET } = await import('../config/b2.js');
  // B2 DeleteObject without VersionId only hides data. Bound each pass and
  // leave its registry row for retry until every version of this exact key is gone.
  const page = await retryRead(objectStorage, signal => b2Client.send(new ListObjectVersionsCommand({
    Bucket: B2_BUCKET, Prefix: key, MaxKeys: 100,
  }), { abortSignal: signal }));
  const versions = (page.Versions || []).filter(version => version.Key === key);
  const markers = (page.DeleteMarkers || []).filter(version => version.Key === key);
  const entries = [...versions, ...markers];
  if (entries.some(version => !version.VersionId)) throw new Error('Storage returned a version without an ID');
  // Keep delete markers until the data versions are gone, so old data stays hidden.
  for (const version of entries) {
    await objectStorage.execute(signal => b2Client.send(new DeleteObjectCommand({
      Bucket: B2_BUCKET, Key: key, VersionId: version.VersionId,
    }), { abortSignal: signal }));
  }
  if (page.IsTruncated && page.NextKeyMarker === key) {
    throw new Error('More object versions remain; cleanup will retry');
  }
}
export function stableImageUrl(key) {
  const path = `/api/upload/image/${Buffer.from(key).toString('base64url')}`;
  return `${(process.env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, '')}${path}`;
}

export async function listNoteImageObjects(continuationToken) {
  const { b2Client, B2_BUCKET } = await import('../config/b2.js');
  return retryRead(objectStorage, signal => b2Client.send(new ListObjectsV2Command({ Bucket: B2_BUCKET, Prefix: 'notes/images/', MaxKeys: 100, ContinuationToken: continuationToken }), { abortSignal: signal }));
}
