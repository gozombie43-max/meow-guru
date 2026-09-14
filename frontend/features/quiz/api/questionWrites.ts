import { API_BASE } from '@/lib/api-base';
import { requestResponse,type RequestPolicy } from '@/shared/api/request';
import { mutate } from 'swr';

let sessionRevision = 0;
export const getQuestionSessionRevision = () => sessionRevision;
const listeners = new Set<() => void>();
export function subscribeQuestionChanges(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const isQuestionQuery = (key: unknown) => typeof key === 'string'
  && key.startsWith(`${API_BASE}/api/questions`) && !key.startsWith(`${API_BASE}/api/questions/session`);

export async function invalidateQuestionQueries() {
  // Existing attempts keep their ordered pages; new mounts get a fresh session key.
  sessionRevision += 1;
  listeners.forEach(listener => listener());
  await mutate(isQuestionQuery, undefined, { revalidate: true });
}

export async function questionWriteResponse(url: string, options: RequestInit = {}, policy: RequestPolicy = {}) {
  const response = await requestResponse(url, options, policy);
  if (response.ok && !['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase())
    && !url.includes('/check-duplicates')) void invalidateQuestionQueries();
  return response;
}
