"use client";
import { useCallback, useState } from 'react';
import type { Difficulty } from '../types';

export interface ResumeData {
  selectedAnswers?: Record<number, number>;
  submittedQuestions?: number[];
  currentIndex?: number;
  conceptFilter?: string;
  examFilter?: string;
  selectedClassificationConcepts?: string[];
  difficulty?: Difficulty;
}
const index = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isResumeData(value: unknown): value is ResumeData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (row.currentIndex !== undefined && !index(row.currentIndex)) return false;
  if (row.selectedAnswers !== undefined && (!row.selectedAnswers || typeof row.selectedAnswers !== 'object' || Array.isArray(row.selectedAnswers) || !Object.entries(row.selectedAnswers).every(([key, value]) => index(Number(key)) && index(value)))) return false;
  if (row.submittedQuestions !== undefined && (!Array.isArray(row.submittedQuestions) || !row.submittedQuestions.every(index))) return false;
  if (row.selectedClassificationConcepts !== undefined && (!Array.isArray(row.selectedClassificationConcepts) || !row.selectedClassificationConcepts.every(value => typeof value === 'string'))) return false;
  if (row.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(String(row.difficulty))) return false;
  return ['conceptFilter', 'examFilter'].every(key => row[key] === undefined || typeof row[key] === 'string');
}
export function useQuizResume(storageKey: string) {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const loadResume = useCallback(() => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
      if (isResumeData(value) && value.submittedQuestions?.length) {
        setResumeData(value);
        return true;
      }
    } catch { /* Invalid or inaccessible storage starts a fresh session. */ }
    return false;
  }, [storageKey]);
  const clearResume = useCallback(() => {
    try { window.localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
    setResumeData(null);
  }, [storageKey]);
  return { resumeData, setResumeData, loadResume, clearResume };
}
