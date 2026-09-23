import { type TrainingSession, modes, type TrainingAction } from "../training-types";
import { Check, Lock } from "lucide-react";

interface TrainingPaletteProps {
  session: TrainingSession;
  showOverview: boolean;
  setShowOverview: (v: boolean) => void;
  canNavigate: boolean;
  busy: boolean;
  act: (action: TrainingAction) => Promise<void>;
}

export function TrainingPalette({ session, showOverview, setShowOverview, canNavigate, busy, act }: TrainingPaletteProps) {
  const answeredCount = Object.values(session.answers).filter((a) => a.choice != null).length;
  const totalQuestions = session.questions.length;

  return (
    <aside id="training-overview" className={`training-session-aside ${showOverview ? "is-open" : ""}`}>
      <section className="training-panel training-sidebar-panel">
        <div className="training-sidebar-header">
          <h2>{canNavigate ? "Question Navigator" : "Session Progress"}</h2>
          <span className="training-sidebar-counter">{answeredCount}/{totalQuestions} Answered</span>
        </div>

        <p className="training-sidebar-desc">
          {canNavigate
            ? "Save your answer before moving. Jump to any question below."
            : modes.find((m) => m.id === session.effectiveMode)?.detail || "Sequential recall training."}
        </p>

        {/* Universal Question Matrix */}
        <div className="training-palette-wrap">
          <div className="training-palette">
            {session.questions.map((item, i) => {
              const isAnswered = session.answers[item.id]?.choice != null;
              const isCurrent = i === session.current;
              const isVisited = i < session.current;
              const isAllowed = canNavigate && session.allowedVisitIndices.includes(i);

              let statusClass = "upcoming";
              if (isCurrent) {
                statusClass = "current";
              } else if (isAnswered) {
                statusClass = "answered";
              } else if (isVisited) {
                statusClass = "skipped";
              }

              if (canNavigate) {
                return (
                  <button
                    key={item.id}
                    data-ui-button="state"
                    aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`training-palette-btn ${statusClass}`}
                    disabled={busy || !isAllowed}
                    onClick={() => {
                      setShowOverview(false);
                      void act({ type: "visit", index: i });
                    }}
                  >
                    {isAnswered && !isCurrent ? <Check size={11} className="training-palette-check" /> : i + 1}
                  </button>
                );
              }

              // Sequential Mode: Visual Progression Matrix
              return (
                <div
                  key={item.id}
                  className={`training-palette-btn training-palette-static ${statusClass}`}
                  aria-label={`Question ${i + 1}${isAnswered ? ", answered" : isCurrent ? ", current" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isAnswered && !isCurrent ? (
                    <Check size={12} className="training-palette-check" />
                  ) : !isVisited && !isCurrent ? (
                    <span className="training-palette-num">{i + 1}</span>
                  ) : (
                    i + 1
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Marking Scheme */}
        <div className="training-sidebar-marking-section">
          <span className="training-marking-title">Scoring Scheme</span>
          <div className="training-marking-badge">
            <span className="marking-pos">+{session.marking.correct} correct</span>
            <span className="marking-neg">−{session.marking.wrong} wrong</span>
            <span className="marking-zero">0 skip</span>
          </div>
        </div>

        <p className="training-footnote">
          The clock continues if you leave this page.
        </p>
      </section>
    </aside>
  );
}
