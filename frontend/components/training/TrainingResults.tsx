import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import api from "@/lib/axios";
import RichContent from "@/components/RichContent";
import { mistakeTypes, type TrainingSession } from "./training-types";

export function TrainingResults({
  session,
  accept,
}: {
  session: TrainingSession;
  accept: (s: TrainingSession) => void;
}) {
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const result = session.result;
  if (!result) return null;
  async function suggest() {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post<TrainingSession>(
        `/api/training/sessions/${session.id}/diagnosis`,
        {},
        { timeout: 60000 },
      );
      accept(data);
    } catch {
      setError(
        "AI suggestions are unavailable. You can still choose your own categories below.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function categorize(questionId: string, mistake: string) {
    if (!mistake) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch<TrainingSession>(
        `/api/training/sessions/${session.id}/mistakes`,
        { questionId, mistake },
      );
      accept(data);
    } catch {
      setError(
        "Could not save that category. Reload the session and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  const topics = [...new Set(result.rows.map((r) => r.topic))];
  return (
    <>
      <div className="training-result-heading">
        <CheckCircle2 size={30} />
        <p className="training-kicker">WORK RECORDED</p>
        <h1>Every session is evidence.</h1>
        <p>
          {result.attempted} attempted · {result.correct} correct ·{" "}
          {result.averageSeconds}s per answer
        </p>
        <Link data-ui-button="primary" href="/play">
          Back to training <ArrowRight size={16} />
        </Link>
      </div>
      <div className="training-stat-grid">
        <section className="training-panel">
          <span>Practice score</span>
          <h2>
            {result.score} <small>/ {result.maxScore}</small>
          </h2>
          <p>{result.negativeLoss} lost to negative marking</p>
        </section>
        <section className="training-panel">
          <span>Accuracy</span>
          <h2>{result.accuracy}%</h2>
          <p>{session.questions.length - result.attempted} left unanswered</p>
        </section>
        <section className="training-panel">
          <span>Time against target</span>
          <h2>{Math.abs(result.secondsSaved)}s</h2>
          <p>
            {result.secondsSaved >= 0 ? "Below" : "Above"} catalog/baseline
            targets in total
          </p>
        </section>
      </div>
      <section className="training-panel">
        <h2>Your next strategic adjustment</h2>
        {["sprint", "survival"].includes(session.mode) && (
          <p>
            {result.modePoints} training points · best streak{" "}
            {result.bestStreak} · {result.questionsPerMinute} questions/min
          </p>
        )}
        {result.findings.length ? (
          result.findings.map((f, i) => <p key={i}>{f}</p>)
        ) : (
          <p>
            No major time-allocation issue detected in this session. Review
            uncertain answers before increasing difficulty.
          </p>
        )}
      </section>
      <section className="training-panel">
        <h2>Topic breakdown</h2>
        {result.masteryDelta?.map((p) => (
          <p key={p.key}>
            {p.topic}: mastery {p.before}% → {p.after}% (
            {p.delta > 0 ? "+" : ""}
            {p.delta} points)
          </p>
        ))}
        {topics.map((topic) => {
          const rows = result.rows.filter((r) => r.topic === topic);
          return (
            <div className="training-list-row" key={topic}>
              <div>
                <strong>{topic}</strong>
                <p>
                  {Math.round(rows.reduce((n, r) => n + r.seconds, 0))}s
                  invested
                </p>
              </div>
              <strong>
                {rows.filter((r) => r.correct).length} / {rows.length} correct
              </strong>
            </div>
          );
        })}
      </section>
      <section className="training-panel">
        <h2>Failure map</h2>
        <p>
          Classify the reason below. These are your labels, not an automatic
          diagnosis.
        </p>
        <div className="training-failure-map">
          {Object.entries(result.failureMap)
            .filter(([, n]) => n > 0)
            .map(([name, n]) => (
              <span key={name}>
                {name} · {n}
              </span>
            ))}
        </div>
        {!result.diagnosis ? (
          <button
            data-ui-button="secondary"
            disabled={saving}
            onClick={suggest}
          >
            {saving ? "Working…" : "Suggest mistake categories with AI"}
          </button>
        ) : (
          <>
            <p>{result.diagnosis.note}</p>
            {result.diagnosis.suggestions.map((s) => (
              <div className="training-list-row" key={s.questionId}>
                <div>
                  <strong>
                    Q
                    {
                      result.rows.find((r) => r.questionId === s.questionId)
                        ?.number
                    }
                    : {s.category}
                  </strong>
                  <p>{s.reason}</p>
                </div>
                <button
                  data-ui-button="secondary"
                  disabled={saving}
                  onClick={() => categorize(s.questionId, s.category)}
                >
                  Use category
                </button>
              </div>
            ))}
          </>
        )}
      </section>
      {error && (
        <p role="alert" className="training-error">
          {error}
        </p>
      )}
      <section className="training-panel">
        <h2>Review your answers</h2>
        {result.rows.map((row) => {
          const q = session.questions.find((q) => q.id === row.questionId)!;
          return (
            <details className="training-answer-review" key={row.questionId}>
              <summary>
                <span
                  className={
                    row.correct ? "training-correct" : "training-incorrect"
                  }
                >
                  Q{row.number} ·{" "}
                  {row.correct
                    ? "Correct"
                    : row.attempted
                      ? "Incorrect"
                      : "Unanswered"}
                </span>
                <span>
                  {Math.round(row.seconds)}s / {row.target}s target
                </span>
              </summary>
              <RichContent text={q.text} />
              {q.image && (
                <RichContent text={`![Question illustration](${q.image})`} />
              )}
              <p>
                <strong>Your answer: </strong>
              </p>
              <RichContent
                text={
                  row.choice === null ? "Left blank" : q.options[row.choice]
                }
              />
              <p>
                <strong>Correct answer: </strong>
              </p>
              <RichContent text={q.options[row.correctIndex]} />
              {row.solution && (
                <>
                  <p>
                    <strong>Explanation</strong>
                  </p>
                  <RichContent text={row.solution} />
                </>
              )}
              <p>Confidence: {row.confidence || "Not recorded"}</p>
              {row.attempted &&
                (!row.correct ||
                  row.confidence !== "sure" ||
                  row.seconds > row.target * 1.5) && (
                  <label className="training-mistake-label">
                    What happened?
                    <select
                      aria-label={`Mistake category for question ${row.number}`}
                      value={row.mistake || ""}
                      disabled={saving}
                      onChange={(e) =>
                        categorize(row.questionId, e.target.value)
                      }
                    >
                      <option value="">Choose a category</option>
                      {mistakeTypes.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                )}
            </details>
          );
        })}
      </section>
    </>
  );
}
