// @ts-check
import { z } from 'zod';
import { tutorPolicySchema } from '../services/tutorPolicy.js';
import { maintenanceQueuePolicy } from './maintenanceQueuePolicy.js';

const secret = z.string().min(32).refine(value => !/^(?:dev-fallback|replace-with)/i.test(value), 'Use an explicit random secret');
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  JWT_SECRET: secret,
  REFRESH_TOKEN_SECRET: secret,
  DEPLOYMENT_ENVIRONMENT: z.enum(['local', 'test', 'staging', 'production']).optional(),
  REDIS_URL: z.string().optional(),
  QUEUE_REDIS_URL: z.string().optional(),
  REDIS_NAMESPACE: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,127}$/, 'Use a bounded explicit namespace').optional(),
  QUEUE_REDIS_NAMESPACE: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,127}$/, 'Use a bounded explicit namespace').optional(),
  BATTLE_REDIS_CRITICAL: z.enum(['true', 'false']).optional(),
  EMBEDDED_WORKERS_CRITICAL: z.enum(['true', 'false']).optional(),
}).superRefine((env, ctx) => {
  if (env.JWT_SECRET === env.REFRESH_TOKEN_SECRET) ctx.addIssue({ code: 'custom', path: ['REFRESH_TOKEN_SECRET'], message: 'Use a separate refresh secret' });
  if (['staging', 'production'].includes(env.DEPLOYMENT_ENVIRONMENT || '') && env.NODE_ENV !== 'production') {
    ctx.addIssue({ code: 'custom', path: ['NODE_ENV'], message: 'Deployed environments require production security settings' });
  }
  if (env.REDIS_URL && env.NODE_ENV === 'production') {
    const parts = (env.REDIS_NAMESPACE || '').toLowerCase().split(/[:_-]/);
    const staging = env.DEPLOYMENT_ENVIRONMENT === 'staging';
    const expected = staging ? ['staging'] : ['prod', 'production'];
    if (!env.REDIS_NAMESPACE || !expected.some(part => parts.includes(part)) || parts.some(part => ['dev', 'development', 'local', 'test', ...(staging ? ['prod', 'production'] : ['staging'])].includes(part))) {
      ctx.addIssue({ code: 'custom', path: ['REDIS_NAMESPACE'], message: `Redis requires an explicit ${staging ? 'staging' : 'production'} namespace` });
    }
  }
  if (env.QUEUE_REDIS_URL && env.NODE_ENV === 'production') {
    const namespace = env.QUEUE_REDIS_NAMESPACE || env.REDIS_NAMESPACE;
    const staging = env.DEPLOYMENT_ENVIRONMENT === 'staging';
    const parts = (namespace || '').toLowerCase().split(/[:_-]/);
    if (!(staging ? parts.includes('staging') : parts.some(part => ['prod', 'production'].includes(part))) || parts.some(part => ['dev', 'development', 'local', 'test', ...(staging ? ['prod', 'production'] : ['staging'])].includes(part))) ctx.addIssue({ code: 'custom', path: ['QUEUE_REDIS_NAMESPACE'], message: 'Queue Redis requires an explicit environment-qualified namespace' });
  }
});

/** @param {NodeJS.ProcessEnv} [env] */
export function validateEnvironment(env = process.env) {
  maintenanceQueuePolicy(env);
  const policy = tutorPolicySchema.safeParse(env);
  if (!policy.success) throw new Error(`Invalid Tutor limits: ${policy.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid backend environment: ${result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return result.data;
}

/** @param {NodeJS.ProcessEnv} [env] */
export const isLocalEnvironment = (env = process.env) => env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
