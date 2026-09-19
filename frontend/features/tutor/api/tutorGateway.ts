import api from '@/shared/api/client';
import { requestGeminiTutor, GEMINI_TUTOR_MODEL, GEMINI_FALLBACK_MODEL } from '@/components/QuizChatbot/gemini';

export type TutorRequest = Parameters<typeof requestGeminiTutor>[0];

// UI components select a model; provider payloads and response handling stay here.
export async function generateTutorReply(input: TutorRequest): Promise<string> {
  if (input.model === GEMINI_TUTOR_MODEL || input.model === GEMINI_FALLBACK_MODEL) return requestGeminiTutor(input);
  const response = await api.post('/api/ai/tutor-chat', {
    context: input.context, message: input.message, mode: 'chat', model: input.model,
    lang: input.lang, history: input.history,
  }, { timeout: 60000 });
  const reply = response.data?.reply || response.data?.explanation;
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('The tutor returned an empty response. Please retry.');
  return reply;
}
