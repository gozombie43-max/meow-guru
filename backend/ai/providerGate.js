// No unbounded in-memory queue during a provider outage or traffic spike.
export function createProviderGate({ concurrency = 8, failureThreshold = 5, cooldownMs = 30000 } = {}) {
  let inFlight = 0, failures = 0, openUntil = 0;
  return async work => {
    if (inFlight >= concurrency || Date.now() < openUntil) {
      throw Object.assign(new Error('AI is temporarily busy. Please retry shortly.'), { statusCode: 503 });
    }
    inFlight++;
    try { const result = await work(); failures = 0; return result; }
    catch (error) {
      if (!error.status || error.status === 429 || error.status >= 500) {
        failures++;
        if (failures >= failureThreshold) openUntil = Date.now() + cooldownMs;
      }
      throw error;
    } finally { inFlight--; }
  };
}
