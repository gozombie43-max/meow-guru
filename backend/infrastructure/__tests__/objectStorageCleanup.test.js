import { beforeEach, expect, it, vi } from 'vitest';
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../config/b2.js', () => ({ b2Client: { send }, B2_BUCKET: 'test-bucket' }));
vi.mock('../dependencyBoundary.js', () => ({
  objectStorage: { execute: operation => operation(undefined) },
  retryRead: (_boundary, operation) => operation(undefined),
}));
import { purgeObjectVersions } from '../objectStorage.js';
const key = 'notes/images/pending/user/image.webp';
beforeEach(() => send.mockReset());

it('permanently deletes only exact-key versions, then their delete markers', async () => {
  send.mockResolvedValueOnce({
    Versions: [{ Key: key, VersionId: 'v1' }, { Key: `${key}.other`, VersionId: 'unrelated' }, { Key: key, VersionId: 'v2' }],
    DeleteMarkers: [{ Key: key, VersionId: 'marker' }],
  }).mockResolvedValue({});
  await purgeObjectVersions(key);
  expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'test-bucket', Prefix: key, MaxKeys: 100 });
  expect(send.mock.calls.slice(1).map(([command]) => command.input)).toEqual(['v1', 'v2', 'marker'].map(VersionId => ({ Bucket: 'test-bucket', Key: key, VersionId })));
});

it('retains the registry for a later bounded pass when more versions remain', async () => {
  send.mockResolvedValueOnce({ Versions: [{ Key: key, VersionId: 'v1' }], IsTruncated: true, NextKeyMarker: key }).mockResolvedValue({});
  await expect(purgeObjectVersions(key)).rejects.toThrow('cleanup will retry');
  expect(send).toHaveBeenCalledTimes(2);
});

it('finishes when the remaining prefix matches belong to other keys', async () => {
  send.mockResolvedValueOnce({ Versions: [{ Key: `${key}.other`, VersionId: 'other' }], IsTruncated: true, NextKeyMarker: `${key}.other` });
  await purgeObjectVersions(key);
  expect(send).toHaveBeenCalledOnce();
});

it('keeps delete markers intact after a storage error and propagates the retry', async () => {
  send.mockResolvedValueOnce({ Versions: [{ Key: key, VersionId: 'v1' }], DeleteMarkers: [{ Key: key, VersionId: 'marker' }] }).mockRejectedValueOnce(new Error('locked version'));
  await expect(purgeObjectVersions(key)).rejects.toThrow('locked version');
  expect(send).toHaveBeenCalledTimes(2);
});

it('refuses ambiguous version IDs and keys outside cleanup namespaces', async () => {
  send.mockResolvedValueOnce({ Versions: [{ Key: key }] });
  await expect(purgeObjectVersions(key)).rejects.toThrow('without an ID');
  expect(send).toHaveBeenCalledOnce();
  send.mockClear();
  for (const invalid of ['questions/kept.png', 'notes/images/../other', undefined]) {
    await expect(purgeObjectVersions(invalid)).rejects.toThrow('Invalid cleanup');
  }
  expect(send).not.toHaveBeenCalled();
});

it('handles absent objects and unversioned null versions for tutor inputs', async () => {
  send.mockResolvedValueOnce({});
  await purgeObjectVersions('tutor-jobs/id/input.json');
  send.mockResolvedValueOnce({ Versions: [{ Key: 'tutor-jobs/id/attachment', VersionId: 'null' }] }).mockResolvedValueOnce({});
  await purgeObjectVersions('tutor-jobs/id/attachment');
  expect(send.mock.calls[2][0].input.VersionId).toBe('null');
});
