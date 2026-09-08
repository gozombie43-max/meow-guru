import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserFindOne = vi.fn();
const mockAuditInsertOne = vi.fn();
const mockSendPushToUser = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    findOne: (...args) => mockUserFindOne(...args),
  }),
  getAuditLogCollection: () => ({
    insertOne: (...args) => mockAuditInsertOne(...args),
  }),
}));

vi.mock('../../services/pushNotificationService.js', () => ({
  sendPushToUser: (...args) => mockSendPushToUser(...args),
}));

import { sendNotification } from '../adminUsers.controller.js';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

function createRequest() {
  return {
    params: { id: 'user_123' },
    body: {
      title: 'Practice reminder',
      body: 'Your daily practice set is ready.',
    },
    user: {
      id: 'admin_1',
      email: 'admin@example.com',
      role: 'admin',
    },
  };
}

describe('adminUsers.controller - sendNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditInsertOne.mockResolvedValue({ insertedId: 'audit_1' });
  });

  it('returns 404 and does not call FCM when the target user does not exist', async () => {
    mockUserFindOne.mockResolvedValueOnce(null);

    const req = createRequest();
    const res = createResponse();

    await sendNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockAuditInsertOne).not.toHaveBeenCalled();
  });

  it('sends through sendPushToUser and returns delivery metrics when FCM accepts the push', async () => {
    mockUserFindOne.mockResolvedValueOnce({
      id: 'user_123',
      name: 'Student',
      email: 'student@example.com',
    });

    mockSendPushToUser.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      invalidDeviceCount: 0,
      notificationId: 'feed_123',
    });

    const req = createRequest();
    const res = createResponse();

    await sendNotification(req, res);

    expect(mockSendPushToUser).toHaveBeenCalledWith('user_123', {
      title: 'Practice reminder',
      body: 'Your daily practice set is ready.',
      category: 'announcements',
      data: {
        type: 'admin_message',
      },
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'Notification sent ✅',
      sent: true,
      successCount: 1,
      failureCount: 0,
      invalidDeviceCount: 0,
      noDevices: false,
      suppressed: false,
      notificationId: 'feed_123',
    });

    expect(mockAuditInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin_1',
        adminEmail: 'admin@example.com',
        action: 'NOTIFICATION_SENT',
        targetUserId: 'user_123',
        details: expect.objectContaining({
          deliveryState: 'sent',
          successCount: 1,
          failureCount: 0,
          notificationId: 'feed_123',
        }),
      })
    );
  });

  it('keeps the inbox notification but reports no push delivery when the user has no active device', async () => {
    mockUserFindOne.mockResolvedValueOnce({
      id: 'user_123',
      name: 'Student',
      email: 'student@example.com',
    });

    mockSendPushToUser.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 0,
      noDevices: true,
      notificationId: 'feed_456',
    });

    const req = createRequest();
    const res = createResponse();

    await sendNotification(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Notification added to the user inbox, but no active Android push device is registered.',
      sent: false,
      successCount: 0,
      failureCount: 0,
      invalidDeviceCount: 0,
      noDevices: true,
      suppressed: false,
      notificationId: 'feed_456',
    });

    expect(mockAuditInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          deliveryState: 'no_devices',
        }),
      })
    );
  });

  it('reports preference suppression without treating it as an FCM failure', async () => {
    mockUserFindOne.mockResolvedValueOnce({
      id: 'user_123',
      name: 'Student',
      email: 'student@example.com',
    });

    mockSendPushToUser.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 0,
      suppressed: true,
      notificationId: 'feed_789',
    });

    const req = createRequest();
    const res = createResponse();

    await sendNotification(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Notification added to the user inbox; push is disabled by the user preferences.',
      sent: false,
      successCount: 0,
      failureCount: 0,
      invalidDeviceCount: 0,
      noDevices: false,
      suppressed: true,
      notificationId: 'feed_789',
    });
  });
});
