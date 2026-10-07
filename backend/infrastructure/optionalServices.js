import { logger } from './logger.js';

const services = new Map();
let stopping = false;
const health = service => service?.state === 'healthy' && !service.ready() ? 'degraded' : service?.state;
export const optionalServiceHealth = () => Object.fromEntries([...services].map(([name, service]) => [name, health(service)]));
export const optionalServiceReady = name => health(services.get(name)) === 'healthy';

export function startOptionalService(name, start, { enabled = true, critical = false, cleanup = async () => {}, ready = () => true } = {}) {
  if (stopping) return Promise.resolve(null);
  if (services.has(name)) return services.get(name).pending;
  const service = { state: enabled ? 'starting' : 'disabled', cleanup, ready, pending: null };
  services.set(name, service);
  service.pending = !enabled ? Promise.resolve(null) : Promise.resolve().then(start).then(async result => {
    if (stopping) { await cleanup(); service.state = 'disabled'; return null; }
    service.state = 'healthy'; return result;
  }).catch(async error => {
    service.state = 'unavailable';
    try { await cleanup(); } catch (failure) { logger.error({ service: name, err: failure }, 'optional service cleanup failed'); }
    logger.warn({ service: name, err: error, critical }, 'optional service unavailable');
    if (critical) throw error;
    return null;
  });
  return service.pending;
}

export async function stopOptionalServices() {
  stopping = true;
  const results = await Promise.allSettled([...services.values()].map(async service => {
    await service.pending.catch(() => {});
    if (service.state === 'healthy') { await service.cleanup(); service.state = 'disabled'; }
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
}
