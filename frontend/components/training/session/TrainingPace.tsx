import { Clock } from "lucide-react";

interface TrainingPaceProps {
  q: import("../training-types").TrainingQuestion;
  seconds: number;
}

export function TrainingPace({ q, seconds }: TrainingPaceProps) {
  if (!q) return null;

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
