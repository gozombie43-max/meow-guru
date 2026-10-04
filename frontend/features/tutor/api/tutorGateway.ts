import api from '@/shared/api/client';
import type { z } from 'zod';
import type { tutorRequestSchema, tutorReplySchema } from '@meow/contracts/tutor';
import { requestGeminiTutor, GEMINI_TUTOR_MODEL, GEMINI_FALLBACK_MODEL } from '@/components/QuizChatbot/gemini';

export type TutorRequest = Parameters<typeof requestGeminiTutor>[0];

// UI components select a model; provider payloads and response handling stay here.
export async function generateTutorReply(input: TutorRequest): Promise<string> {
  if (input.model === GEMINI_TUTOR_MODEL || input.model === GEMINI_FALLBACK_MODEL) return requestGeminiTutor(input);
  const body = {
    context: input.context, message: input.message,
    lang: input.lang === 'hi' || input.lang === 'bn' ? input.lang : 'en', history: input.history,
  } satisfies z.input<typeof tutorRequestSchema>;
  const response = await api.post('/api/ai/tutor-chat', { ...body, mode: 'chat', model: input.model }, { timeout: 60000 });
  const { reply }: z.output<typeof tutorReplySchema> = response.data;
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('The tutor returned an empty response. Please retry.');
  return reply;
}
