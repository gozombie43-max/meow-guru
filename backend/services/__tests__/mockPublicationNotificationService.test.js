import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSlotsUpdateOne = vi.fn();
const mockHistoryInsertOne = vi.fn();
const mockSendPushToAllUsers = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getMockSlotsCollection: () => ({
    updateOne: (...args) => mockSlotsUpdateOne(...args),
  }),
  getNotificationHistoryCollection: () => ({
    insertOne: (...args) => mockHistoryInsertOne(...args),
  }),
}));

vi.mock('../pushNotificationService.js', () => ({
  sendPushToAllUsers: (...args) => mockSendPushToAllUsers(...args),
}));

import { notifyNewMockPublished } from '../mockPublicationNotificationService.js';

describe('notifyNewMockPublished', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips notification if id or examSlug is missing', async () => {
    const res1 = await notifyNewMockPublished({ id: '', examSlug: 'ssc-cgl' });
    expect(res1).toEqual({ skipped: true, reason: 'invalid-slot' });

    const res2 = await notifyNewMockPublished({ id: 'cgl-mock-1', examSlug: '' });
    expect(res2).toEqual({ skipped: true, reason: 'invalid-slot' });

    expect(mockSlotsUpdateOne).not.toHaveBeenCalled();
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it('skips notification if slot type is not mock (e.g. pyq)', async () => {
    const res = await notifyNewMockPublished({
      id: 'cgl-2024-shift1',
      examSlug: 'ssc-cgl',
      title: 'SSC CGL 2024 Shift 1',
      type: 'pyq',
    });

    expect(res).toEqual({ skipped: true, reason: 'not-mock' });
    expect(mockSlotsUpdateOne).not.toHaveBeenCalled();
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it('skips notification if slot is already claimed or notified (idempotency check)', async () => {
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    const res = await notifyNewMockPublished({
      id: 'cgl-mock-1',
      examSlug: 'ssc-cgl',
      title: 'SSC CGL Tier 1 Mock 1',
      type: 'mock',
    });

    expect(mockSlotsUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cgl-mock-1',
        examSlug: 'ssc-cgl',
        newMockNotificationClaimedAt: { $exists: false },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          newMockNotificationStatus: 'processing',
        }),
      })
    );

    expect(res).toEqual({ skipped: true, reason: 'already-notified' });
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it('claims slot, sends push broadcast, updates slot status to sent, and inserts audit record', async () => {
    // 1st updateOne: claim
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    // push notification broadcast
    mockSendPushToAllUsers.mockResolvedValueOnce({
      ok: true,
      totalDevices: 45,
      successCount: 43,
      failureCount: 2,
      invalidDeviceCount: 1,
    });

    // 2nd updateOne: mark sent
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    mockHistoryInsertOne.mockResolvedValueOnce({ insertedId: 'hist_123' });

    const res = await notifyNewMockPublished({
      id: 'cgl-mock-14',
      examSlug: 'ssc-cgl',
      title: 'SSC CGL Full Mock Test 14',
      tier: 'tier-1',
      type: 'mock',
    });

    expect(res.sent).toBe(true);
    expect(res.totalDevices).toBe(45);
    expect(res.successCount).toBe(43);

    // Verify claim query
    expect(mockSlotsUpdateOne).toHaveBeenNthCalledWith(
      1,
      {
        id: 'cgl-mock-14',
        examSlug: 'ssc-cgl',
        newMockNotificationClaimedAt: { $exists: false },
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          newMockNotificationStatus: 'processing',
        }),
      })
    );

    // Verify push payload
    expect(mockSendPushToAllUsers).toHaveBeenCalledWith({
      title: 'New Mock Test 🎯',
      body: 'SSC CGL Full Mock Test 14 is now available.',
      route: '/mock-test/ssc-cgl/cgl-mock-14',
      category: 'newMocks',
      centerKey: 'new-mock:ssc-cgl:cgl-mock-14',
      data: {
        type: 'new_mock',
        examSlug: 'ssc-cgl',
        testId: 'cgl-mock-14',
        tier: 'tier-1',
      },
    });

    // Verify slot update on success
    expect(mockSlotsUpdateOne).toHaveBeenNthCalledWith(
      2,
      {
        id: 'cgl-mock-14',
        examSlug: 'ssc-cgl',
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          newMockNotificationStatus: 'sent',
          newMockNotificationResult: {
            totalDevices: 45,
            successCount: 43,
            failureCount: 2,
            invalidDeviceCount: 1,
          },
        }),
      })
    );

    // Verify history audit record
    expect(mockHistoryInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'new-mock',
        title: 'New Mock Test 🎯',
        body: 'SSC CGL Full Mock Test 14 is now available.',
        route: '/mock-test/ssc-cgl/cgl-mock-14',
        examSlug: 'ssc-cgl',
        testId: 'cgl-mock-14',
        mockTitle: 'SSC CGL Full Mock Test 14',
        totalDevices: 45,
        successCount: 43,
        failureCount: 2,
        invalidDeviceCount: 1,
      })
    );
  });

  it('marks slot as failed if sendPushToAllUsers throws, keeping claim to prevent duplicate retry storms', async () => {
    // 1st updateOne: claim succeeds
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    // sendPushToAllUsers fails
    mockSendPushToAllUsers.mockRejectedValueOnce(new Error('FCM connection error'));

    // 2nd updateOne: mark failed
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await notifyNewMockPublished({
      id: 'cgl-mock-14',
      examSlug: 'ssc-cgl',
      title: 'SSC CGL Full Mock Test 14',
      type: 'mock',
    });

    expect(res).toEqual({ sent: false, error: true });

    // Verify slot updated to failed
    expect(mockSlotsUpdateOne).toHaveBeenNthCalledWith(
      2,
      {
        id: 'cgl-mock-14',
        examSlug: 'ssc-cgl',
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          newMockNotificationStatus: 'failed',
          newMockNotificationError: expect.stringContaining('FCM connection error'),
        }),
      })
    );

    // History should not have been inserted on push failure
    expect(mockHistoryInsertOne).not.toHaveBeenCalled();
  });

  it('returns success even if recording to notification history throws', async () => {
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockSendPushToAllUsers.mockResolvedValueOnce({
      ok: true,
      totalDevices: 10,
      successCount: 10,
      failureCount: 0,
    });
    mockSlotsUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    // Audit history throws
    mockHistoryInsertOne.mockRejectedValueOnce(new Error('Mongo history duplicate key'));

    const res = await notifyNewMockPublished({
      id: 'cgl-mock-14',
      examSlug: 'ssc-cgl',
      title: 'SSC CGL Full Mock Test 14',
      type: 'mock',
    });

    expect(res.sent).toBe(true);
    expect(res.successCount).toBe(10);
  });
});
