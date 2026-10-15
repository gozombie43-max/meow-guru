import { assertSession } from './sessions.js';
import { onSocketAuthorizationInvalidated } from './socketInvalidation.js';

export const SOCKET_AUTH_TTL_MS = 10_000;
const expired = () => new Error('Session expired');

// One bounded principal per connected socket, with one in-flight authority read.
// REST authorization remains authoritative on every request. Socket revocation
// is immediate on the eviction channel and bounded by this TTL if delivery fails.
export function createSocketPrincipal(decoded, { validate = assertSession, now = Date.now, ttl = SOCKET_AUTH_TTL_MS, onInvalidated = () => {} } = {}) {
  let principal, validUntil = 0, pending, revoked = false, generation = 0;
  const unsubscribe = onSocketAuthorizationInvalidated(event => {
    if (event.all || (event.sid ? event.sid === decoded.sid : String(event.userId) === String(decoded.id))) {
      generation++; validUntil = 0;
      if (!event.revalidate) { revoked = true; onInvalidated(); }
    }
  });
  const check = () => {
    if (revoked || (Number.isFinite(decoded.exp) && decoded.exp * 1000 <= now())) throw expired();
  };
  return {
    async get() {
      check();
      if (principal && validUntil > now()) return principal;
      if (!pending) {
        const version = generation;
        pending = (async () => {
          const started = now(), result = await validate(decoded);
          check();
          if (version !== generation) throw expired();
          principal = result;
          validUntil = Math.min(started + ttl, Number.isFinite(decoded.exp) ? decoded.exp * 1000 : Infinity);
          if (validUntil <= now()) throw expired();
          return principal;
        })().finally(() => { pending = null; });
      }
      return pending;
    },
    close() { revoked = true; generation++; unsubscribe(); principal = null; },
  };
}
