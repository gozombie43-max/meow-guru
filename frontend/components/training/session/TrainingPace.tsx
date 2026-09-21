import { Clock } from "lucide-react";

import type { TrainingSession } from '../training-types';
import { useTrainingNow, type TrainingTimeSync } from './hooks/useTrainingClock';

interface TrainingPaceProps {
  q: import("../training-types").TrainingQuestion;
  session: TrainingSession;
  timeSync: TrainingTimeSync;
}

export function TrainingPace({ q, session, timeSync }: TrainingPaceProps) {
  const now = Math.min(useTrainingNow(timeSync), new Date(session.deadline).getTime());
  const seconds = Math.round((session.answers[q.id]?.seconds || 0) + Math.max(0, now - session.lastEventAt) / 1000);

  return (
    <div
      className={`training-pace ${seconds > q.expectedTime ? "is-slower" : "is-faster"}`}
    >
      <div className="training-pace-pill">
        <Clock size={14} />
        <span className="training-pace-times">
          Target <strong>{q.expectedTime}s</strong> · You{" "}
          <strong>{seconds}s</strong>
        </span>
        <span
          className={`training-pace-delta ${seconds > q.expectedTime ? "delta-slow" : "delta-fast"}`}
        >
          {seconds - q.expectedTime > 0 ? "+" : ""}
          {seconds - q.expectedTime}s
        </span>
      </div>
      <small className="training-pace-source">
        {q.targetSource === "baseline"
          ? "Baseline target"
          : q.targetSource === "personalized"
            ? "Personal target"
            : "Catalog target"}
      </small>
    </div>
  );
}
