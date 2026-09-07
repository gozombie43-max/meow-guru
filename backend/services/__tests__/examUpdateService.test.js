import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockSendPushToAllUsers = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getExamUpdatesCollection: () => ({
    insertOne: (...args) => mockInsertOne(...args),
    updateOne: (...args) => mockUpdateOne(...args),
  }),
}));

vi.mock('../pushNotificationService.js', () => ({
  sendPushToAllUsers: (...args) => mockSendPushToAllUsers(...args),
}));

import { publishExamUpdate } from '../examUpdateService.js';

describe('examUpdateService - publishExamUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes a new exam update, dispatches push notification, and updates status to sent', async () => {
    mockInsertOne.mockResolvedValueOnce({ insertedId: 'update_1' });
    mockSendPushToAllUsers.mockResolvedValueOnce({
      ok: true,
      totalDevices: 50,
      successCount: 48,
      failureCount: 2,
      invalidDeviceCount: 1,
    });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const payload = {
      examSlug: 'ssc-cgl',
      type: 'admit-card',
      title: 'SSC CGL Admit Card Released 🎫',
      message: 'The SSC CGL admit card is now available.',
      route: '/exam-updates/ssc-cgl',
      sourceUrl: 'https://ssc.gov.in',
      createdByUserId: 'admin_1',
      createdByEmail: 'admin@example.com',
    };

    const res = await publishExamUpdate(payload);

    expect(res).toEqual({
      sent: true,
      ok: true,
      totalDevices: 50,
      successCount: 48,
      failureCount: 2,
      invalidDeviceCount: 1,
    });

    const expectedKey = 'ssc-cgl:admit-card:ssc cgl admit card released 🎫';

    // Verify insertOne
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        updateKey: expectedKey,
        examSlug: 'ssc-cgl',
        type: 'admit-card',
        title: 'SSC CGL Admit Card Released 🎫',
        message: 'The SSC CGL admit card is now available.',
        route: '/exam-updates/ssc-cgl',
        sourceUrl: 'https://ssc.gov.in',
        status: 'publishing',
        createdByUserId: 'admin_1',
        createdByEmail: 'admin@example.com',
        createdAt: expect.any(Date),
        publishedAt: expect.any(Date),
      })
    );

    // Verify push notification dispatch with examUpdates category
    expect(mockSendPushToAllUsers).toHaveBeenCalledWith({
      title: 'SSC CGL Admit Card Released 🎫',
      body: 'The SSC CGL admit card is now available.',
      route: '/exam-updates/ssc-cgl',
      category: 'examUpdates',
      centerKey: 'exam-update:ssc-cgl:admit-card:ssc cgl admit card released 🎫',
      data: {
        type: 'exam_update',
        examSlug: 'ssc-cgl',
        updateType: 'admit-card',
      },
    });

    // Verify status updated to sent
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { updateKey: expectedKey },
      {
        $set: {
          status: 'sent',
          notificationResult: {
            totalDevices: 50,
            successCount: 48,
            failureCount: 2,
            invalidDeviceCount: 1,
          },
        },
      }
    );
  });

  it('uses default route if route is not provided', async () => {
    mockInsertOne.mockResolvedValueOnce({ insertedId: 'update_2' });
    mockSendPushToAllUsers.mockResolvedValueOnce({
      ok: true,
      totalDevices: 10,
      successCount: 10,
      failureCount: 0,
      invalidDeviceCount: 0,
    });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const payload = {
      examSlug: 'ssc-chsl',
      type: 'exam-date',
      title: 'SSC CHSL Exam Dates Announced',
      message: 'Tier 1 dates announced for June 2026.',
    };

    const res = await publishExamUpdate(payload);
    expect(res.sent).toBe(true);

    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/exam-updates/ssc-chsl',
      })
    );

    expect(mockSendPushToAllUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/exam-updates/ssc-chsl',
      })
    );
  });

  it('detects duplicates when insertOne throws duplicate key error code 11000', async () => {
    const duplicateError = new Error('E11000 duplicate key error');
    duplicateError.code = 11000;
    mockInsertOne.mockRejectedValueOnce(duplicateError);

    const payload = {
      examSlug: 'ssc-cgl',
      type: 'admit-card',
      title: 'SSC CGL Admit Card Released 🎫',
      message: 'Duplicate send test',
    };

    const res = await publishExamUpdate(payload);

    expect(res).toEqual({
      duplicate: true,
      sent: false,
    });

    // Push notification must NEVER be dispatched for duplicate
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('rethrows unexpected database error during insertOne', async () => {
    mockInsertOne.mockRejectedValueOnce(new Error('Mongo connection lost'));

    const payload = {
      examSlug: 'ssc-cgl',
      type: 'result',
      title: 'SSC CGL Final Result Declared',
      message: 'Check your merit list.',
    };

    await expect(publishExamUpdate(payload)).rejects.toThrow('Mongo connection lost');
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it('marks update as failed and rethrows if sendPushToAllUsers throws', async () => {
    mockInsertOne.mockResolvedValueOnce({ insertedId: 'update_3' });
    mockSendPushToAllUsers.mockRejectedValueOnce(new Error('FCM gateway error'));
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const payload = {
      examSlug: 'ssc-cgl',
      type: 'answer-key',
      title: 'SSC CGL Answer Key Released',
      message: 'Submit objections by Sunday.',
    };

    await expect(publishExamUpdate(payload)).rejects.toThrow('FCM gateway error');

    const expectedKey = 'ssc-cgl:answer-key:ssc cgl answer key released';

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { updateKey: expectedKey },
      {
        $set: {
          status: 'failed',
          error: 'FCM gateway error',
        },
      }
    );
  });
});
