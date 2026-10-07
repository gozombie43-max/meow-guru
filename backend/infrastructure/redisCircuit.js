// Only the optional command client uses this circuit. Subscribers reconnect
// independently and cannot hold request traffic in their retry loop.
export function createRedisCircuit({ threshold = 5, intervalMs = 10000, cooldownMs = 15000, now = Date.now } = {}) {
  let failures = [], openUntil = 0, probing = false;
  return {
    state() { return probing ? 'half-open' : openUntil ? 'open' : 'closed'; },
    admit() {
      if (!openUntil) return 'normal';
      if (now() < openUntil || probing) return 'skip';
      probing = true;
      return 'probe';
    },
    failure() {
      const time = now();
      failures = failures.filter(at => time - at < intervalMs);
      if (failures.length < threshold) failures.push(time);
      if (probing || failures.length >= threshold) openUntil = time + cooldownMs;
      probing = false;
    },
    recovered() { failures = []; openUntil = 0; probing = false; },
    unavailable() { openUntil = now() + cooldownMs; probing = false; },
    reset() { failures = []; openUntil = 0; probing = false; },
  };
}
