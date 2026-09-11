import Link from "next/link";
import { Shield } from "lucide-react";
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
  if (tab === "Review")
    return (
      <section className="training-panel">
        <div className="training-panel-heading">
          <div>
            <h2>{dashboard?.due.length || 0} questions due</h2>
            <p>
              Wrong → 1 day → 3 days → 7 days → 21 days. Successful reviews
              extend the interval.
            </p>
          </div>
          <button
            data-ui-button="primary"
            disabled={!dashboard?.due.length}
            onClick={() => choose("review")}
          >
            Start review
          </button>
        </div>
        {loading ? (
          <p role="status">Loading review queue…</p>
        ) : !dashboard?.reviews.length ? (
          <div className="training-empty">
            <Shield size={30} />
            <h3>A fresh start.</h3>
            <p>
              Wrong, uncertain and slow answers will appear here after training.
            </p>
          </div>
        ) : (
          dashboard.reviews.map((r) => (
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
