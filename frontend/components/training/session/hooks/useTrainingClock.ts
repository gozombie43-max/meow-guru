import { useEffect } from "react";
import { type TrainingSession, type TrainingAction } from "../../training-types";

export function useTrainingClock(
  session: TrainingSession | null,
  offset: React.MutableRefObject<number>,
  now: number,
  setNow: (n: number) => void,
  act: (action: TrainingAction) => Promise<void>,
  busy: boolean,
  error: string
) {
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, [offset, setNow]);

  const remaining = session
    ? Math.max(
        0,
        Math.ceil((new Date(session.deadline).getTime() - now) / 1000),
      )
    : 0;

  useEffect(() => {
    if (session?.status !== "active" || remaining !== 0 || busy || error)
      return;
    const timeout = setTimeout(() => void act({ type: "finish" }), 0);
    return () => clearTimeout(timeout);
  }, [session, remaining, busy, error, act]);

  return { remaining };
}
