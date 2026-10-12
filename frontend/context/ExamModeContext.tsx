"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { EXAM_MODE_KEY, type ExamMode } from '@/lib/exam-mode';
const listeners = new Set<() => void>();
let fallback: ExamMode = 'ssc';
let volatileMode: ExamMode | null = null;
function read(): ExamMode {
  if (volatileMode) return volatileMode;
  try { return localStorage.getItem(EXAM_MODE_KEY) === 'iit-jam' ? 'iit-jam' : 'ssc'; }
  catch { return fallback; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (!event.key || event.key === EXAM_MODE_KEY) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}
function setMode(mode: ExamMode) {
  fallback = mode;
  try { localStorage.setItem(EXAM_MODE_KEY, mode); volatileMode = null; } catch { volatileMode = mode; }
  listeners.forEach(listener => listener());
}
const Context = createContext({ mode: 'ssc' as ExamMode, isJam: false, setMode });
export function ExamModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, read, () => 'ssc' as ExamMode);
  return <Context.Provider value={{ mode, isJam: mode === 'iit-jam', setMode }}>{children}</Context.Provider>;
}
export const useExamMode = () => useContext(Context);
