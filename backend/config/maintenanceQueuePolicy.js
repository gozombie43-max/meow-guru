import { z } from 'zod';

export const maintenanceQueuePolicySchema = z.object({
  QUEUE_MAX_WAITING_JOBS: z.coerce.number().int().min(1).max(20000).default(20000),
  QUEUE_MAX_DELAYED_JOBS: z.coerce.number().int().min(1).max(20000).default(5000),
  QUEUE_OWNER_MAX_ENQUEUES: z.coerce.number().int().min(1).max(10000).default(100),
  QUEUE_OWNER_WINDOW_MS: z.coerce.number().int().min(1000).max(86400000).default(60000),
  QUEUE_DEDUPE_WINDOW_MS: z.coerce.number().int().min(1000).max(86400000).default(3600000),
  QUEUE_MAX_READY_AGE_MS: z.coerce.number().int().min(1000).max(86400000).default(1800000),
});
export function maintenanceQueuePolicy(env = process.env) {
  const result = maintenanceQueuePolicySchema.safeParse(env);
  if (!result.success) throw new Error(`Invalid queue policy: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  return result.data;
}

// A different Redis database or ACL account still shares server memory/policy.
export function sameRedisServer(a, b) {
  if (!a || !b) return false;
  const identity = value => { const url = new URL(value); return `${url.hostname.toLowerCase().replace(/\.$/, '')}:${url.port || 6379}`; };
  return identity(a) === identity(b);
}
