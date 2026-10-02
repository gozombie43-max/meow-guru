import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
export function stableImageUrl(key) {
  const path = `/api/upload/image/${Buffer.from(key).toString('base64url')}`;
  return `${(process.env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, '')}${path}`;
}
