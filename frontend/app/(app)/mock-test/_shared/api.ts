import { API_BASE } from '@/lib/api-base';
import type { MockTestSlot } from './exam-config';

const BASE = API_BASE;

export type MockAnswer = string | number;
export type QuestionStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked'
  | 'answered_marked';

export interface MockOption {
  id: string;
  text: string;
}

export interface MockQuestion {
  id: string;
  text?: string;
  question?: string;
  options?: Array<string | MockOption>;
  image?: string;
  questionImage?: string;
  solution?: string;
  solutionImage?: string;
}

export interface MockSection {
  id?: string;
  key?: string;
  title?: string;
  label?: string;
  questions: MockQuestion[];
}

export interface MockPaper {
  examName?: string;
  totalDurationMin?: number;
  sections: MockSection[];
}

export interface MockAttempt {
  id?: string;
  attemptId?: string;
  paper?: MockPaper;
  answers?: Record<string, MockAnswer>;
  answerKey?: Record<string, MockAnswer>;
  questionStatuses?: Record<string, QuestionStatus>;
  timeLeft?: number;
  status?: 'in_progress' | 'completed';
}

export interface AttemptProgress {
  answers: Record<string, MockAnswer>;
  questionStatuses: Record<string, QuestionStatus>;
  currentSection: number;
  currentQuestion: number;
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body: { error?: string } = await readJson<{ error?: string }>(response).catch(
    () => ({})
  );
  return body.error || fallback;
}

function getHeaders(token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getAdminHeaders(adminSecret: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-secret': adminSecret,
  };
}

// ─── Slot Endpoints ───────────────────────────────────────

export async function getExamSlots(examSlug: string): Promise<{ slots: MockTestSlot[] }> {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/slots`);
  if (!res.ok) throw new Error(`Failed to fetch slots for ${examSlug}`);
  return readJson<{ slots: MockTestSlot[] }>(res);
}

export async function getSlotDetails(slotId: string, examSlug?: string): Promise<{ slot: MockTestSlot }> {
  const query = examSlug ? `?examSlug=${encodeURIComponent(examSlug)}` : '';
  const res = await fetch(`${BASE}/api/mocktest/slots/${slotId}${query}`);
  if (!res.ok) throw new Error(`Failed to fetch slot ${slotId}`);
  return readJson<{ slot: MockTestSlot }>(res);
}

// ─── Admin Slot Management Endpoints ──────────────────────

export async function adminCreateSlot(slotData: Record<string, unknown>, adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots`, {
    method: 'POST',
    headers: getAdminHeaders(adminSecret),
    body: JSON.stringify(slotData),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to create slot'));
  }
  return res.json();
}

export async function adminUpdateSlot(slotId: string, examSlug: string, updates: Record<string, unknown>, adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots/${slotId}`, {
    method: 'PATCH',
    headers: getAdminHeaders(adminSecret),
    body: JSON.stringify({ examSlug, ...updates }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to update slot'));
  }
  return res.json();
}

export async function adminDeleteSlot(slotId: string, examSlug: string, adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots/${slotId}?examSlug=${encodeURIComponent(examSlug)}`, {
    method: 'DELETE',
    headers: getAdminHeaders(adminSecret),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete slot');
  }
  return res.json();
}

export async function adminSeedSlots(adminSecret: string) {
  const res = await fetch(`${BASE}/api/mocktest/admin/slots/seed`, {
    method: 'POST',
    headers: getAdminHeaders(adminSecret),
  });
  if (!res.ok) throw new Error('Failed to seed default slots');
  return res.json();
}

// ─── Test Attempt Endpoints ───────────────────────────────

export async function startTest(examSlug: string, testId: string, token: string): Promise<MockAttempt & { attemptId: string }> {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/${testId}/start`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to start test');
  return readJson<MockAttempt & { attemptId: string }>(res);
}

export async function autosaveAttempt(attemptId: string, data: AttemptProgress, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/attempt/${attemptId}/autosave`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to autosave');
  return res.json();
}

export async function submitAttempt(attemptId: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/attempt/${attemptId}/submit`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to submit test');
  return res.json();
}

export async function getAttempt(attemptId: string, token: string): Promise<MockAttempt> {
  const res = await fetch(`${BASE}/api/mocktest/attempt/${attemptId}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to get attempt');
  return readJson<MockAttempt>(res);
}

export async function getTestHistory(examSlug: string, testId: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/${testId}/history`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch test history');
  return res.json();
}

export async function getExamHistory(examSlug: string, token: string) {
  const res = await fetch(`${BASE}/api/mocktest/${examSlug}/history`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch exam history');
  return res.json();
}
