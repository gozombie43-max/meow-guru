import { EventEmitter } from 'node:events';

// Separate from sessions to avoid a sessions -> socket validator import cycle.
const events = new EventEmitter();
events.setMaxListeners(0);
export const invalidateSocketAuthorization = event => events.emit('invalidate', event);
export function onSocketAuthorizationInvalidated(listener) {
  events.on('invalidate', listener);
  return () => events.off('invalidate', listener);
}
