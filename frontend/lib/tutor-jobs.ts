import api from '@/shared/api/client';
import { tutorJobResponseSchema, tutorReplySchema } from '@meow/contracts/tutor';
import { TutorJobError } from './tutor-job-error';
export { TutorJobError } from './tutor-job-error';

function wait(ms: number, signal?: AbortSignal, untilVisible = false) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible);
    };
    const done = () => { cleanup(); resolve(); };
    const cancel = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const visible = () => { if (document.visibilityState === 'visible') done(); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', cancel, { once: true });
    if (untilVisible && typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
    if (signal?.aborted) cancel();
  });
}

export async function waitForTutorJob(jobId: string, signal?: AbortSignal): Promise<string> {
  const deadline = Date.now() + 10 * 60 * 1000;
  let delay = 1500;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      await wait(Math.max(0, deadline - Date.now()), signal, true);
      continue;
    }
    const { data, headers } = await api.get(`/api/ai/tutor-jobs/${encodeURIComponent(jobId)}`, { signal }).catch(error => {
      if (error?.response?.status === 404) throw new TutorJobError('This attachment job has expired. Please attach the file again.');
      throw error;
    });
    const job = tutorJobResponseSchema.parse(data);
    if (job.status === 'completed') return tutorReplySchema.parse(job).reply;
    if (job.status === 'failed' || job.status === 'cancelled') throw new TutorJobError(job.error || 'Attachment processing cancelled');
    const retryAfter = headers?.['retry-after'];
    const hint = retryAfter ? (Number(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now()) : 0;
    await wait(Math.min(deadline - Date.now(), Math.max(delay, Math.min(30000, hint || 0))), signal, true);
    delay = Math.min(15000, Math.round(delay * 1.6));
  }
  throw new TutorJobError('Your attachment is still processing. Refresh this page to check again.', false);
}
