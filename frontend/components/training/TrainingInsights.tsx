import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import TrainingMockCatalog from "./TrainingMockCatalog";
import { modes, type ModeId, type TrainingDashboard } from "./training-types";

export function TrainingInsights({
  tab,
  dashboard,
  loading,
  exam,
  choose,
}: {
  tab: string;
  dashboard: TrainingDashboard | null;
  loading: boolean;
  exam: string;
  choose: (mode: ModeId) => void;
}) {
  if (tab === "Train Me")
    return (
      <section className="training-panel">
        <h2>Today’s sequence</h2>
        <p>
          One session combines the available blocks below. Your mission stays
          saved for today; missing catalog blocks are omitted.
        </p>
        {loading ? (
          <p role="status">Loading mission…</p>
        ) : (
          (dashboard?.mission || []).map((step, i) => (
            <div className="training-list-row" key={`${step.mode}-${i}`}>
              <span className="training-step">{i + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>
                  {step.count} recommended questions · {step.mode}
                </p>
              </div>
            </div>
          ))
        )}
        <p className="training-footnote">
          Readiness gain is measured after completed work; we do not promise an
          estimated increase.
        </p>
      </section>
    );
  if (tab === "Mock") return <TrainingMockCatalog key={exam} exam={exam} />;
  if (tab === "Review") {
    const dueCount = dashboard?.due.length || 0;
    const hasReviews = !!dashboard?.reviews.length;

    return (
      <section className="training-panel training-review-panel">
        <div className="training-panel-heading">
          <div>
            <p className="training-kicker">SPACED REPETITION QUEUE</p>
            <h2>{dueCount > 0 ? `${dueCount} questions due today` : "Spaced Review"}</h2>
            <p>
              Wrong → 1 day → 3 days → 7 days → 21 days. Successful reviews extend the interval.
            </p>
          </div>
          {dueCount > 0 && (
            <button
              data-ui-button="primary"
              onClick={() => choose("review")}
            >
              Start review ({dueCount})
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {loading ? (
          <p role="status" className="training-loading-note">Loading review queue…</p>
        ) : dueCount === 0 && !hasReviews ? (
          <div className="training-review-empty">
            <div className="training-review-empty-icon">
              <CheckCircle2 size={30} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h3>Review queue is clear · All caught up!</h3>
            <p className="training-review-empty-desc">
              You have no questions waiting for review. Practice questions you find challenging or mark unsure to schedule them for spaced repetition.
            </p>
            <div className="training-interval-stepper" aria-label="Spaced repetition interval schedule">
              <span className="interval-step">Wrong</span>
              <span className="interval-arrow">→</span>
              <span className="interval-step">1 day</span>
              <span className="interval-arrow">→</span>
              <span className="interval-step">3 days</span>
              <span className="interval-arrow">→</span>
              <span className="interval-step">7 days</span>
              <span className="interval-arrow">→</span>
              <span className="interval-step">21 days</span>
            </div>
            <div className="training-review-actions">
              <button
                data-ui-button="secondary"
                onClick={() => choose("adaptive")}
              >
                <Sparkles size={15} aria-hidden="true" />
                Practice adaptive session
              </button>
            </div>
          </div>
        ) : dueCount === 0 && hasReviews ? (
          <div className="training-review-empty">
            <div className="training-review-empty-icon">
              <CheckCircle2 size={30} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h3>No reviews due right now</h3>
            <p className="training-review-empty-desc">
              All scheduled questions are up to date. You can practice adaptive sessions or inspect upcoming review dates below.
            </p>
            <div className="training-review-actions">
              <button
                data-ui-button="secondary"
                onClick={() => choose("adaptive")}
              >
                <Sparkles size={15} aria-hidden="true" />
                Start practice session
              </button>
            </div>
            <div className="training-upcoming-reviews">
              <h4>Upcoming review items ({dashboard?.reviews.length})</h4>
              {dashboard?.reviews.slice(0, 5).map((r) => (
                <div className="training-list-row" key={r.questionId}>
                  <div>
                    <strong>{r.topic}</strong>
                    <p>
                      {r.reason}
                      {r.mistake ? ` · ${r.mistake}` : ""}
                    </p>
                  </div>
                  <time dateTime={r.dueAt}>
                    Due {new Date(r.dueAt).toLocaleDateString()}
                  </time>
                </div>
              ))}
            </div>
          </div>
        ) : (
          dashboard?.reviews.map((r) => (
            <div className="training-list-row" key={r.questionId}>
              <div>
                <strong>{r.topic}</strong>
                <p>
                  {r.reason}
                  {r.mistake ? ` · ${r.mistake}` : ""}
                </p>
              </div>
              <time dateTime={r.dueAt}>
                {new Date(r.dueAt).toLocaleDateString()}
              </time>
            </div>
          ))
        )}
      </section>
    );
  }
  return (
    <>
      <div className="training-stat-grid">
        <div className="training-panel">
          <span>Practice readiness</span>
          <h2>{dashboard?.readiness ?? "—"} / 100</h2>
          <p>
            {dashboard?.evidence || "Complete training to build your baseline."}
          </p>
        </div>
        <div className="training-panel">
          <span>Answers recorded</span>
          <h2>{dashboard?.attempts || 0}</h2>
          <p>Correct guesses receive less mastery credit.</p>
        </div>
        <div className="training-panel">
          <span>Survival personal best</span>
          <h2>{dashboard?.personalBest || 0}</h2>
          <p>Correct answers in one run</p>
        </div>
      </div>
      <section className="training-panel">
        <h2>Why this score?</h2>
        <p>
          Accuracy 20% · Mastery 20% · Speed 15% · Catalog coverage 10% ·
          Difficulty 10% · Mock performance 10% · Consistency 10% · Negative
          marking 5%
        </p>
        {Object.entries(dashboard?.factors || {}).map(([name, value]) => (
          <div className="training-factor" key={name}>
            <span>{name}</span>
            <div className="training-meter">
              <i style={{ width: `${value}%` }} />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
        <p>
          To improve: work through the weakest topics below, answer with
          confidence and approach the target time.
        </p>
      </section>
      <section className="training-panel">
        <h2>Topics to strengthen</h2>
        {dashboard?.topics.length ? (
          dashboard.topics.map((p) => (
            <div className="training-list-row" key={p.key}>
              <div>
                <strong>{p.topic}</strong>
                <p>
                  {p.subject} · {p.attempts} answers · {Math.round(p.seconds)}s
                  average
                </p>
              </div>
              <strong>{Math.round(p.mastery * 100)}%</strong>
            </div>
          ))
        ) : (
          <p>No topic evidence yet.</p>
        )}
      </section>
      <section className="training-panel">
        <h2>Recent sessions</h2>
        {dashboard?.history.length ? (
          dashboard.history.map((s) => (
            <Link
              className="training-list-row"
              href={`/play/session/${s.id}`}
              key={s.id}
            >
              <div>
                <strong>
                  {modes.find((m) => m.id === s.mode)?.title || "Review"}
                </strong>
                <p>
                  {new Date(s.at).toLocaleDateString()} · {s.accuracy}% accuracy
                </p>
              </div>
              <strong>
                {s.score} / {s.maxScore}
              </strong>
            </Link>
          ))
        ) : (
          <p>Your completed sessions will appear here.</p>
        )}
      </section>
    </>
  );
}
