import api from '@/shared/api/client';
import { tutorJobResponseSchema, tutorReplySchema } from '@meow/contracts/tutor';
import { TutorJobError } from './tutor-job-error';
export { TutorJobError } from './tutor-job-error';

export async function waitForTutorJob(jobId: string, signal?: AbortSignal): Promise<string> {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const { data } = await api.get(`/api/ai/tutor-jobs/${encodeURIComponent(jobId)}`, { signal }).catch(error => {
      if (error?.response?.status === 404) throw new TutorJobError('This attachment job has expired. Please attach the file again.');
      throw error;
    });
    const job = tutorJobResponseSchema.parse(data);
    if (job.status === 'completed') return tutorReplySchema.parse(job).reply;
    if (job.status === 'failed' || job.status === 'cancelled') throw new TutorJobError(job.error || 'Attachment processing cancelled');
    await new Promise<void>((resolve, reject) => {
      const done = () => { signal?.removeEventListener('abort', cancel); resolve(); };
      const timer = setTimeout(done, 1500);
      const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(new DOMException('Aborted', 'AbortError')); };
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
    });
  }
  throw new TutorJobError('Your attachment is still processing. Refresh this page to check again.', false);
}
