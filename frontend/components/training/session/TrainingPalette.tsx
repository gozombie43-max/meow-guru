import { X } from "lucide-react";
import { type TrainingSession, modes, type TrainingAction } from "../training-types";

interface TrainingPaletteProps {
  session: TrainingSession;
  showOverview: boolean;
  setShowOverview: (v: boolean) => void;
  canNavigate: boolean;
  busy: boolean;
  act: (action: TrainingAction) => Promise<void>;
}

export function TrainingPalette({ session, showOverview, setShowOverview, canNavigate, busy, act }: TrainingPaletteProps) {
  return (
    <>
      {showOverview && (
        <div 
          className="training-palette-backdrop" 
          onClick={() => setShowOverview(false)} 
          aria-hidden="true" 
        />
      )}
      <aside id="training-overview" className={`training-session-aside ${showOverview ? "is-open" : ""}`} aria-hidden={!showOverview}>
        <section className="training-panel training-sidebar-panel">
          <div className="training-sidebar-header">
            <h2>
              {canNavigate ? "Question Navigator" : "Session Brief"}
            </h2>
            <button
              type="button"
              className="training-sidebar-close"
              onClick={() => setShowOverview(false)}
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        {canNavigate ? (
          <>
            <p className="training-sidebar-desc">
              Save your answer before moving. Choose any available question below.
            </p>
            <div className="training-palette">
              {session.questions
                .map((item, i) => ({ item, i }))
                .filter(({ i }) => session.allowedVisitIndices.includes(i))
                .map(({ item, i }) => {
                const isAnswered =
                  session.answers[item.id]?.choice != null;
                const isCurrent = i === session.current;
                return (
                  <button
                    key={item.id}
                    data-ui-button="state"
                    aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`training-palette-btn ${isAnswered ? "answered" : ""} ${isCurrent ? "current" : ""}`}
                    disabled={busy}
                    onClick={() => { setShowOverview(false); void act({ type: "visit", index: i }); }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="training-sidebar-desc">
            {modes.find((m) => m.id === session.effectiveMode)?.detail ||
              "Review due questions. Successful recall extends the next interval."}
          </p>
        )}
        <div className="training-marking-badge">
          <span className="marking-pos">+{session.marking.correct} correct</span>
          <span className="marking-neg">−{session.marking.wrong} wrong</span>
          <span className="marking-zero">0 unattempted</span>
        </div>
        <p className="training-footnote">
          The clock continues if you leave this page.
        </p>
      </section>
    </aside>
  </>
  );
}
