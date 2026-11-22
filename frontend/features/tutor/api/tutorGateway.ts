import api from '@/shared/api/client';
import type { z } from 'zod';
import type { tutorRequestSchema, tutorReplySchema } from '@meow/contracts/tutor';
import { requestGeminiTutor, GEMINI_TUTOR_MODEL, GEMINI_FALLBACK_MODEL } from '@/components/QuizChatbot/gemini';

export type TutorRequest = Parameters<typeof requestGeminiTutor>[0] & {
  signal?: AbortSignal;
  idempotencyKey?: string;
};

function createTutorIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// UI components select a model; provider payloads and response handling stay here.
export async function generateTutorReply(input: TutorRequest): Promise<string> {
  if (input.model === GEMINI_TUTOR_MODEL || input.model === GEMINI_FALLBACK_MODEL) return requestGeminiTutor(input);
  const body = {
    context: input.context, message: input.message,
    lang: input.lang === 'hi' || input.lang === 'bn' ? input.lang : 'en', history: input.history,
  } satisfies z.input<typeof tutorRequestSchema>;
  const idempotencyKey = input.idempotencyKey || createTutorIdempotencyKey();
  const response = await api.post(
    '/api/ai/tutor-chat',
    { ...body, mode: 'chat', model: input.model },
    {
      timeout: 60000,
      headers: { 'Idempotency-Key': idempotencyKey },
      ...(input.signal ? { signal: input.signal } : {}),
    }
  );
  const { reply }: z.output<typeof tutorReplySchema> = response.data;
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('The tutor returned an empty response. Please retry.');
  return reply;
}
