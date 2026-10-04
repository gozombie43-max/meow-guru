import { afterAll, beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import sharp from 'sharp';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession, evictUserSessionCache, revokeSession } from '../../auth/sessions.js';
import { verifyToken, signToken } from '../../auth/jwt.js';
import { cleanupNoteImages } from '../../services/notes/noteImageCleanup.js';
import { claimNoteImageCleanup, trackPendingNoteImage } from '../../repositories/noteImageRepository.js';
import { reserveTutorUsage, acquireTutorSlot, releaseTutorSlot } from '../../repositories/tutorQuotaRepository.js';
import { enqueueTutorJob } from '../../services/tutorJobs.js';
import { beginTutorUpload, claimTutorInputCleanup, cancelOwnedTutorJob, releaseTutorUpload } from '../../repositories/tutorJobRepository.js';
import { claimJob } from '../../infrastructure/durableQueue.js';
import { noteImageKeys, isNoteImageKey } from '../../services/notes/imageKeys.js';
import { up } from '../../migrations/015-audit-security.js';

const { objects, putObject, purgeObjectVersions, limiterIdentity, tutorChat } = vi.hoisted(() => ({ objects: new Map(), putObject: vi.fn(), purgeObjectVersions: vi.fn(), limiterIdentity: vi.fn(), tutorChat: vi.fn() }));
vi.mock('../../infrastructure/objectStorage.js', () => ({
  putObject, purgeObjectVersions,
  stableImageUrl: key => `/api/upload/image/${Buffer.from(key).toString('base64url')}`,
  listNoteImageObjects: async () => ({ Contents: [] }),
}));
vi.mock('../../middleware/rateLimiter.js', () => ({ aiLimiter: (req, _res, next) => { limiterIdentity(req.user?.id); next(); } }));
vi.mock('../../services/tutorChatService.js', () => ({ tutorChat }));
import uploadRouter from '../uploadNoteImage.js';
import notesRouter from '../notes.routes.js';
import aiRouter from '../aiRoutes.js';

let mongo, db, server, base, image;
const tokens = {};
const auth = role => role ? { Authorization: `Bearer ${tokens[role]}` } : {};
const upload = (role, bytes = image, type = 'image/png') => {
  const body = new FormData(); body.set('image', new Blob([bytes], { type }), 'note.png');
  return fetch(`${base}/api/upload-note-image`, { method: 'POST', headers: auth(role), body });
};
const write = (role, method = 'POST', path = '/api/notes', data = { title: 'Note', body: '<p>Hello</p>' }) => fetch(base + path, { method, headers: { ...auth(role), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri(); process.env.MONGODB_DB = 'audit_security';
  db = await connectMongoDB(); await up(db);
  image = await sharp({ create: { width: 5, height: 5, channels: 3, background: 'blue' } }).png().toBuffer();
  const app = express(); app.use(express.json());
  app.use('/api/upload-note-image', uploadRouter); app.use('/api/notes', notesRouter); app.use('/api/ai', aiRouter);
  app.use((error, _req, res, _next) => res.status(error.statusCode || error.status || 500).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  vi.resetAllMocks(); objects.clear();
  putObject.mockImplementation(async (key, bytes, type) => objects.set(key, { bytes, type }));
  purgeObjectVersions.mockImplementation(async key => objects.delete(key));
  tutorChat.mockResolvedValue({ success: true, reply: 'Answer' });
  for (const name of ['notes', 'noteImages', 'runtimeMaintenance', 'users', 'authSessions', 'aiLeases', 'runtimeJobs', 'tutorDailyUsage', 'tutorSlots', 'tutorObjects']) await db.collection(name).deleteMany({});
  for (const role of ['admin', 'superadmin', 'user', 'student', 'moderator', 'unknown']) {
    await evictUserSessionCache(role);
    await db.collection('users').insertOne({ id: role, role, email: `${role}@example.test` });
    tokens[role] = (await createSession({ id: role })).token;
  }
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { server?.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo?.stop(); });

it.each([null, 'user', 'student', 'moderator', 'unknown'])('rejects note images and all note mutations for %s before storage', async role => {
  const expected = role ? 403 : 401;
  expect((await upload(role)).status).toBe(expected);
  for (const [method, path] of [['POST', '/api/notes'], ['PUT', '/api/notes/other'], ['DELETE', '/api/notes/other']]) expect((await write(role, method, path)).status).toBe(expected);
  expect(putObject).not.toHaveBeenCalled(); expect(await db.collection('notes').countDocuments()).toBe(0);
  expect((await fetch(base + '/api/notes')).status).toBe(200);
});
it.each(['admin', 'superadmin'])('allows %s image upload and note creation/edit/deletion, then collects removed images', async role => {
  const response = await upload(role); expect(response.status).toBe(200);
  const { key, url } = await response.json();
  expect(objects.get(key).type).toBe('image/webp'); expect((await sharp(objects.get(key).bytes).metadata()).format).toBe('webp');
  const created = await write(role, 'POST', '/api/notes', { title: 'Image', body: `<img src="${url}">`, imageKeys: ['question-images/forged.png'] });
  expect(created.status).toBe(201); const note = await created.json(); expect(note.imageKeys).toEqual([key]);
  expect((await write(role, 'PUT', `/api/notes/${note.id}`, { body: 'removed' })).status).toBe(200);
  expect(await cleanupNoteImages()).toBe(1); expect(objects.has(key)).toBe(false);
  expect((await write(role, 'DELETE', `/api/notes/${note.id}`)).status).toBe(200);
});
it('rejects invalid tokens, revoked sessions, suspended admins and stale elevated role claims', async () => {
  const token = tokens.admin; await revokeSession(verifyToken(token)); expect((await upload('admin')).status).toBe(401);
  tokens.admin = (await createSession({ id: 'admin' })).token;
  await db.collection('users').updateOne({ id: 'admin' }, { $set: { role: 'user' } }); expect((await upload('admin')).status).toBe(403);
  await db.collection('users').updateOne({ id: 'superadmin' }, { $set: { status: 'suspended' } }); await evictUserSessionCache('superadmin'); expect((await upload('superadmin')).status).toBe(401);
  tokens.admin = 'invalid'; expect((await upload('admin')).status).toBe(401);
  const current = verifyToken(tokens.user);
  tokens.admin = signToken({ id: current.id, sid: current.sid, role: 'admin' }); expect((await upload('admin')).status).toBe(403);
  expect(putObject).not.toHaveBeenCalled();
});
it('rejects spoofed/oversized uploads and accepts real bytes with a spoofed client MIME', async () => {
  expect((await upload('admin', Buffer.from('fake'), 'image/png')).status).toBe(400);
  expect((await upload('admin', Buffer.alloc(5 * 1024 * 1024 + 1))).status).toBe(413);
  expect(putObject).not.toHaveBeenCalled();
  expect((await upload('admin', image, 'application/octet-stream')).status).toBe(200);
});
it('keeps shared images, collects abandoned uploads and retries a storage deletion failure', async () => {
  const { key, url } = await (await upload('admin')).json();
  const first = await (await write('admin', 'POST', '/api/notes', { body: `<img src="${url}">` })).json();
  const second = await (await write('admin', 'POST', '/api/notes', { body: `<img src="${url}">` })).json();
  await write('admin', 'DELETE', `/api/notes/${first.id}`); expect(await cleanupNoteImages()).toBe(0); expect(objects.has(key)).toBe(true);
  await write('admin', 'DELETE', `/api/notes/${second.id}`);
  purgeObjectVersions.mockRejectedValueOnce(new Error('B2 unavailable'));
  expect(await cleanupNoteImages()).toBe(0); expect(await db.collection('noteImages').findOne({ _id: key })).toBeTruthy();
  expect(await cleanupNoteImages(new Date(Date.now() + 2 * 3600000))).toBe(1);
  const abandoned = await (await upload('admin')).json();
  expect(await cleanupNoteImages(new Date(Date.now() + 49 * 3600000))).toBe(1); expect(objects.has(abandoned.key)).toBe(false);
});
it('fences saves during cleanup and only extracts keys from the note image namespace', async () => {
  const { key, url } = await (await upload('admin')).json();
  await claimNoteImageCleanup(new Date(Date.now() + 49 * 3600000));
  expect((await write('admin', 'POST', '/api/notes', { body: `<img src="${url}">` })).status).toBe(409);
  expect(noteImageKeys(null)).toEqual([]); expect(noteImageKeys(`${url} ${url}`)).toEqual([key]);
  expect(isNoteImageKey('notes/images/../outside.webp')).toBe(false);
  expect(noteImageKeys(`/api/upload/image/${Buffer.from('question-images/private.webp').toString('base64url')}`)).toEqual([]);
});
it('requires login for Tutor submit/poll/cancel before applying quotas and uses account identity', async () => {
  for (const [method, path] of [['POST', '/api/ai/tutor-chat'], ['GET', '/api/ai/tutor-jobs/a'], ['DELETE', '/api/ai/tutor-jobs/a']]) expect((await fetch(base + path, { method })).status).toBe(401);
  expect(limiterIdentity).not.toHaveBeenCalled();
  const response = await write('user', 'POST', '/api/ai/tutor-chat', { context: 'Algebra', message: 'Help', history: [], lang: 'en' });
  expect(response.status).toBe(200); expect(limiterIdentity).toHaveBeenCalledWith('user');
});
it('stores raw attachment bytes, preserves idempotency and isolates job ownership', async () => {
  const input = { context: 'Maths', message: 'Help' };
  const file = { originalname: 'q.png', mimetype: 'image/png', buffer: image };
  const job = await enqueueTutorJob('user', input, file, 'same-upload');
  expect(objects.get(job.attachmentKey).bytes).toEqual(image); expect(job.input).toEqual(input); expect(job.inputKey).toBeUndefined(); expect(JSON.stringify(job)).not.toContain(image.toString('base64'));
  expect((await enqueueTutorJob('user', input, file, 'same-upload'))._id).toBe(job._id); expect(putObject).toHaveBeenCalledOnce();
  await expect(enqueueTutorJob('user', { ...input, message: 'Other' }, file, 'same-upload')).rejects.toMatchObject({ statusCode: 409 });
  expect((await fetch(`${base}/api/ai/tutor-jobs/${job._id}`, { headers: auth('admin') })).status).toBe(404);
  expect((await fetch(`${base}/api/ai/tutor-jobs/${job._id}`, { headers: auth('user') })).status).toBe(200);
  expect((await fetch(`${base}/api/ai/tutor-jobs/${job._id}`, { method: 'DELETE', headers: auth('admin') })).status).toBe(404);
  expect((await fetch(`${base}/api/ai/tutor-jobs/${job._id}`, { method: 'DELETE', headers: auth('user') })).status).toBe(200);
});
it('atomically caps daily requests, attachment bytes and conservative model tokens', async () => {
  vi.stubEnv('TUTOR_DAILY_REQUESTS', '2');
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => reserveTutorUsage('user', {})));
  expect(attempts.filter(row => row.status === 'fulfilled')).toHaveLength(2);
  expect(attempts.filter(row => row.status === 'rejected').every(row => row.reason.statusCode === 429)).toBe(true);
  vi.stubEnv('TUTOR_DAILY_ATTACHMENT_BYTES', '10');
  await expect(reserveTutorUsage('other', {}, 11)).rejects.toMatchObject({ statusCode: 429 });
  await reserveTutorUsage('bytes', {}, 6); await expect(reserveTutorUsage('bytes', {}, 6)).rejects.toMatchObject({ statusCode: 429 });
  vi.stubEnv('TUTOR_DAILY_TOKEN_ALLOWANCE', '18501');
  await expect(reserveTutorUsage('tokens', { long: 'x'.repeat(100) })).rejects.toMatchObject({ statusCode: 429 });
  expect(await db.collection('tutorDailyUsage').findOne({ _id: `user:${new Date().toISOString().slice(0, 10)}` })).toMatchObject({ requests: 2 });
});
it.each(['queued', 'running'])('atomically caps %s jobs independently for each user and frees released slots', async kind => {
  vi.stubEnv(kind === 'queued' ? 'TUTOR_QUEUED_JOBS' : 'TUTOR_RUNNING_JOBS', '2');
  const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => acquireTutorSlot('user', kind)));
  const slots = attempts.filter(row => row.status === 'fulfilled').map(row => row.value); expect(slots).toHaveLength(2);
  await expect(acquireTutorSlot('other', kind)).resolves.toBeTruthy();
  await releaseTutorSlot(slots[0]); await expect(acquireTutorSlot('user', kind)).resolves.toBeTruthy();
});
it('backfills legacy note references on repeat migrations without overwriting existing keys', async () => {
  const key = 'notes/images/old.webp'; const body = `/api/upload/image/${Buffer.from(key).toString('base64url')}`;
  await db.collection('notes').insertOne({ id: 'old', body }); await up(db); await up(db);
  expect((await db.collection('notes').findOne({ id: 'old' })).imageKeys).toEqual([key]);
  await trackPendingNoteImage('notes/images/test.webp', 'admin');
  expect(await claimJob(db.collection('runtimeJobs'), 'tutor')).toBeNull();
});
it('does not charge the same logical Tutor request twice under concurrent retries', async () => {
  vi.stubEnv('TUTOR_DAILY_REQUESTS', '1');
  const now = new Date();
  await Promise.all(Array.from({ length: 6 }, () => reserveTutorUsage('user', {}, 0, now, 'same-request')));
  expect(await db.collection('tutorDailyUsage').findOne({ _id: `user:${now.toISOString().slice(0, 10)}` })).toMatchObject({ requests: 1 });
  await expect(reserveTutorUsage('user', {}, 0, now, 'different-request')).rejects.toMatchObject({ statusCode: 429 });
});
it('fences cleanup and concurrent upload retries and preserves cancelled upload cleanup intent', async () => {
  const now = new Date();
  const job = { _id: 'staging', kind: 'tutor', userId: 'user', status: 'staging', createdAt: new Date(+now - 31 * 60000), expiresAt: new Date(+now + 86400000), attachmentKey: 'tutor-jobs/staging/attachment' };
  await db.collection('runtimeJobs').insertOne(job);
  expect(await beginTutorUpload(job._id, 'uploader', now)).toBeTruthy();
  expect(await beginTutorUpload(job._id, 'concurrent', now)).toBeNull();
  expect(await claimTutorInputCleanup(now)).toBeNull();
  await cancelOwnedTutorJob('user', job._id);
  expect(await claimTutorInputCleanup(now)).toBeNull();
  await releaseTutorUpload(job._id, 'uploader');
  expect(await claimTutorInputCleanup(now)).toMatchObject({ _id: job._id, status: 'cancelled' });
  expect(await beginTutorUpload(job._id, 'late', now)).toBeNull();
});
