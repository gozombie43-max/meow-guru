import Link from "next/link";
import { ArrowLeft, Clock, Brain, Target, Zap, Timer, Layers, Route, Flame, Shield, RotateCcw, Sparkles } from "lucide-react";
import { type TrainingSession, type ModeId, modes } from "../training-types";

function ModeIcon({ mode }: { mode?: ModeId | string }) {
  switch (mode) {
    case "adaptive": return <Brain size={16} />;
    case "challenge": return <Target size={16} />;
    case "sprint": return <Zap size={16} />;
    case "pressure": return <Timer size={16} />;
    case "section": return <Layers size={16} />;
    case "gauntlet": return <Route size={16} />;
    case "nightmare": return <Flame size={16} />;
    case "survival": return <Shield size={16} />;
    case "review": return <RotateCcw size={16} />;
    case "mission": return <Sparkles size={16} />;
    default: return <Brain size={16} />;
  }
}

const clock = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${String(Math.max(0, n) % 60).padStart(2, "0")}`;

interface TrainingSessionHeaderProps {
  session: TrainingSession | null;
  remaining: number;
  busy: boolean;
  setConfirmFinish: (v: boolean) => void;
}

export function TrainingSessionHeader({ session, remaining, busy, setConfirmFinish }: TrainingSessionHeaderProps) {
  return (
    <header className="training-session-header" data-ui-chrome="header">
      <Link replace
        href="/play"
        data-ui-button="icon"
        className="training-header-back"
        aria-label="Back to Play"
      >
        <ArrowLeft size={18} />
      </Link>
      <div className="training-session-title-wrap">
        <div className="training-session-title-row">
          <div className="training-session-mode-badge" aria-hidden="true">
            <ModeIcon mode={session?.mode} />
          </div>
          <strong>
            {modes.find((m) => m.id === session?.mode)?.title || "Training"}
          </strong>
        </div>
        <span>
          {session?.exam.replaceAll("-", " ").toUpperCase()} ·{" "}
          {session?.status === "completed"
            ? "Session complete"
            : session ? `Question ${session.current + 1} of ${session.questions.length}` : "Preparing your session"}
        </span>
      </div>
      {session?.status === "active" && (
        <div
          className={`training-clock ${remaining < 60 ? "training-clock-urgent" : ""}`}
          role="timer"
          aria-label={`Time remaining: ${clock(remaining)}`}
        >
          <Clock size={16} />
          <span>{clock(remaining)}</span>
        </div>
      )}
      {session?.status === "active" && (
        <button data-ui-button="secondary" className="training-header-finish" aria-label="Finish session" disabled={busy} onClick={() => setConfirmFinish(true)}>
          Finish
        </button>
      )}
    </header>
  );
}
