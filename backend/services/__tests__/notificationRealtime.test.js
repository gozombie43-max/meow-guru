import { describe, it, expect, vi } from 'vitest';
import {
  setNotificationRealtimeServer,
  emitNotificationToUser,
  emitGlobalNotification,
} from '../notificationRealtime.js';

describe('notificationRealtime', () => {
  it('safely handles emits when server is not yet set', () => {
    setNotificationRealtimeServer(null);
    expect(() => emitNotificationToUser('user_1', { test: true })).not.toThrow();
    expect(() => emitGlobalNotification({ test: true })).not.toThrow();
  });

  it('emits to user room when server is set', () => {
    const mockEmit = vi.fn();
    const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    const mockIo = { to: mockTo, emit: vi.fn() };

    setNotificationRealtimeServer(mockIo);

    emitNotificationToUser('user_42', { title: 'Hello' });

    expect(mockTo).toHaveBeenCalledWith('user:user_42');
    expect(mockEmit).toHaveBeenCalledWith('notification:new', { title: 'Hello' });
  });

  it('emits globally when server is set', () => {
    const mockIo = { to: vi.fn(), emit: vi.fn() };

    setNotificationRealtimeServer(mockIo);

    emitGlobalNotification({ title: 'Global announcement' });

    expect(mockIo.emit).toHaveBeenCalledWith('notification:new', {
      title: 'Global announcement',
    });
  });
});
