import api from '@/lib/axios';

export class TutorJobError extends Error {
  constructor(message: string, public terminal = true) { super(message); }
}

export async function waitForTutorJob(jobId: string, signal?: AbortSignal): Promise<string> {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const { data } = await api.get(`/api/ai/tutor-jobs/${encodeURIComponent(jobId)}`, { signal }).catch(error => {
      if (error?.response?.status === 404) throw new TutorJobError('This attachment job has expired. Please attach the file again.');
      throw error;
    });
    if (data.status === 'completed') return data.reply;
    if (data.status === 'failed' || data.status === 'cancelled') throw new TutorJobError(data.error || 'Attachment processing cancelled');
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
