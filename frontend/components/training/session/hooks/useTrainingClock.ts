import { useEffect, useState } from 'react';
import type { TrainingSession, TrainingAction } from '../../training-types';

export interface TrainingTimeSync { serverNow: number; receivedAt: number }
export const trainingNow = (sync: TrainingTimeSync) => sync.serverNow + Date.now() - sync.receivedAt;

// Tick only the small clock and pace components, never the question page.
export function useTrainingNow(sync: TrainingTimeSync) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return trainingNow(sync);
}

export function useTrainingClock(
  session: TrainingSession | null,
  sync: TrainingTimeSync,
  act: (action: TrainingAction) => Promise<void>,
  busy: boolean,
  error: string,
) {
  const [expiredDeadline, setExpiredDeadline] = useState('');
  useEffect(() => {
    if (session?.status !== 'active') return;
    const deadline = new Date(session.deadline).getTime();
    const timer = setTimeout(() => setExpiredDeadline(session.deadline), Math.max(0, deadline - trainingNow(sync)));
    return () => clearTimeout(timer);
  }, [session?.status, session?.deadline, sync]);

  const expired = !!session && (expiredDeadline === session.deadline || trainingNow(sync) >= new Date(session.deadline).getTime());
  useEffect(() => {
    if (session?.status !== 'active' || !expired || busy || error) return;
    const timer = setTimeout(() => void act({ type: 'finish' }), 0);
    return () => clearTimeout(timer);
  }, [session?.status, expired, busy, error, act]);
  return { expired };
}
