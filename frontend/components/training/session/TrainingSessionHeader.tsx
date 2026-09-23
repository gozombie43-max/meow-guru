import Link from "next/link";
import { ArrowLeft, Clock, Brain, Target, Zap, Timer, Layers, Route, Flame, Shield, RotateCcw, Sparkles, Heart, List } from "lucide-react";
import { type TrainingSession, type ModeId, modes } from "../training-types";
import { useTrainingNow, type TrainingTimeSync } from './hooks/useTrainingClock';

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

function TrainingClock({ deadline, timeSync }: { deadline: string; timeSync: TrainingTimeSync }) {
  const now = useTrainingNow(timeSync);
  const remaining = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  return (
    <div className={`training-clock ${remaining < 60 ? "training-clock-urgent" : ""}`} role="timer" aria-label={`Time remaining: ${clock(remaining)}`}>
      <Clock size={16} /><span>{clock(remaining)}</span>
    </div>
  );
}

interface TrainingSessionHeaderProps {
  session: TrainingSession | null;
  timeSync: TrainingTimeSync;
  busy: boolean;
  setConfirmFinish: (v: boolean) => void;
  showOverview?: boolean;
  setShowOverview?: (v: boolean | ((prev: boolean) => boolean)) => void;
  answered?: number;
  canNavigate?: boolean;
}

export function TrainingSessionHeader({
  session,
  timeSync,
  busy,
  setConfirmFinish,
  showOverview = false,
  setShowOverview,
  answered = 0,
  canNavigate = false
}: TrainingSessionHeaderProps) {
  const isActive = session?.status === "active";
  const totalQuestions = session?.questions.length ?? 0;
  const currentQNum = (session?.current ?? 0) + 1;
  const progressPct = totalQuestions > 0 ? (answered / totalQuestions) * 100 : 0;

  return (
    <header className="training-session-header" data-ui-chrome="header">
      {/* Top Main Row */}
      <div className="training-header-main-row">
        <div className="training-header-left">
          <Link
            replace
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
              {session?.exam.replaceAll("-", " ").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Desktop Center (Shown on Desktop >= 1024px) */}
        {isActive && (
          <div className="training-header-desktop-center">
            {setShowOverview && (
              <button
                type="button"
                className={`training-header-overview-btn ${showOverview ? "is-active" : ""}`}
                aria-expanded={showOverview}
                aria-controls="training-overview"
                onClick={() => setShowOverview(!showOverview)}
                title={canNavigate ? "Question Navigator" : "Session info"}
              >
                <List size={15} />
                <span>{canNavigate ? "Questions" : "Session info"}</span>
              </button>
            )}

            <span className="training-header-counter">
              QUESTION {currentQNum} OF {totalQuestions}
            </span>

            {session.effectiveMode === "survival" ? (
              <div
                className="training-survival-lives"
                aria-label={`${session.lives} lives remaining`}
              >
                <span className="training-lives-label">LIVES</span>
                <div className="training-lives-hearts">
                  {[1, 2, 3].map((lifeIndex) => {
                    const isAlive = lifeIndex <= session.lives;
                    return (
                      <Heart
                        key={lifeIndex}
                        size={14}
                        className={`training-heart-icon ${isAlive ? "is-alive" : "is-lost"}`}
                        fill={isAlive ? "currentColor" : "none"}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="training-header-answered-meta">
                <span className="training-header-answered-pill">
                  {answered} / {totalQuestions} answered
                </span>
              </div>
            )}
          </div>
        )}

        <div className="training-header-right">
          {isActive && (
            <TrainingClock deadline={session.deadline} timeSync={timeSync} />
          )}
          {isActive && (
            <button
              type="button"
              data-ui-button="secondary"
              className="training-header-finish"
              aria-label="Finish session"
              disabled={busy}
              onClick={() => setConfirmFinish(true)}
            >
              Finish
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-row (Shown on Mobile < 1024px) */}
      {isActive && (
        <div className="training-header-mobile-subrow">
          {setShowOverview && (
            <button
              type="button"
              className={`training-header-mobile-overview-btn ${showOverview ? "is-active" : ""}`}
              aria-expanded={showOverview}
              aria-controls="training-overview"
              onClick={() => setShowOverview(!showOverview)}
            >
              <List size={14} />
              <span>{canNavigate ? "Questions" : "Session info"}</span>
            </button>
          )}

          <span className="training-header-mobile-counter">
            QUESTION {currentQNum} OF {totalQuestions}
          </span>

          {session.effectiveMode === "survival" ? (
            <div
              className="training-survival-lives"
              aria-label={`${session.lives} lives remaining`}
            >
              <span className="training-lives-label">LIVES</span>
              <div className="training-lives-hearts">
                {[1, 2, 3].map((lifeIndex) => {
                  const isAlive = lifeIndex <= session.lives;
                  return (
                    <Heart
                      key={lifeIndex}
                      size={13}
                      className={`training-heart-icon ${isAlive ? "is-alive" : "is-lost"}`}
                      fill={isAlive ? "currentColor" : "none"}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <span className="training-header-mobile-answered">
              {answered} / {totalQuestions} answered
            </span>
          )}
        </div>
      )}

      {/* Integrated Progress Track Pin to Header Bottom */}
      {isActive && totalQuestions > 0 && (
        <div className="training-header-progress-track">
          <div
            className="training-header-progress-bar"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={answered}
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
          />
        </div>
      )}
    </header>
  );
}
