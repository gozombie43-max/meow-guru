import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Award,
  MinusCircle,
  PlusCircle,
  HelpCircle,
} from "lucide-react";
import api from "@/shared/api/client";
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
  const incorrectCount = result.attempted - result.correct;
  const unattemptedCount = session.questions.length - result.attempted;
  const correctMarksGained = Number((result.correct * session.marking.correct).toFixed(2));
  const negativeMarksLost = Number((incorrectCount * session.marking.wrong).toFixed(2));
  const ratioToCancel = session.marking.wrong > 0 ? (session.marking.correct / session.marking.wrong).toFixed(0) : "0";

  return (
    <div className="training-results-container">
      <div className="training-result-heading">
        <div className="training-result-icon-badge">
          <CheckCircle2 size={32} />
        </div>
        <p className="training-kicker">SESSION COMPLETE</p>
        <h1>Every session is evidence.</h1>
        <p className="training-result-subtext">
          {result.attempted} attempted · {result.correct} correct ·{" "}
          {result.averageSeconds}s per answer
        </p>
        <Link replace data-ui-button="primary" href="/play" className="training-result-cta">
          <span>Back to training</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="training-stat-grid">
        <section className="training-panel training-stat-panel">
          <span className="training-stat-label">Practice score</span>
          <h2 className="training-stat-value">
            {result.score} <small>/ {result.maxScore}</small>
          </h2>
          <p className={`training-stat-note ${result.negativeLoss > 0 ? "stat-has-penalty" : "stat-clean"}`}>
            {result.negativeLoss > 0
              ? `−${result.negativeLoss} lost to negative marking`
              : "0 lost to negative marking"}
          </p>
        </section>

        <section className="training-panel training-stat-panel">
          <span className="training-stat-label">Accuracy</span>
          <h2 className="training-stat-value">{result.accuracy}%</h2>
          <p className="training-stat-note">
            {unattemptedCount} left unanswered (0 penalty)
          </p>
        </section>

        <section className="training-panel training-stat-panel">
          <span className="training-stat-label">Time against target</span>
          <h2 className="training-stat-value">{Math.abs(result.secondsSaved)}s</h2>
          <p className="training-stat-note">
            {result.secondsSaved >= 0 ? "Below" : "Above"} catalog/baseline
            targets in total
          </p>
        </section>
      </div>

      {/* Official Marking & Calculation Breakdown */}
      <section className="training-panel training-scoring-breakdown-panel">
        <div className="training-panel-header">
          <div className="training-scoring-header-row">
            <div>
              <span className="training-kicker">OFFICIAL MARKING SCHEME</span>
              <h2>Scoring &amp; Negative Marking Breakdown</h2>
            </div>
            <div className="training-marking-rule-pills">
              <span className="marking-pos">+{session.marking.correct} Correct</span>
              <span className="marking-neg">−{session.marking.wrong} Wrong</span>
              <span className="marking-zero">0 Unattempted</span>
            </div>
          </div>
          <p className="training-panel-subtitle">
            {session.exam.replaceAll("-", " ").toUpperCase()} official rules:
            {session.marking.wrong > 0 && (
              <> In this tier, <strong>{ratioToCancel} wrong answers</strong> equal <strong>−{session.marking.correct} marks</strong>, cancelling the score of <strong>1 correct answer</strong>.</>
            )}
          </p>
        </div>

        <div className="training-scoring-cards-grid">
          <div className="training-scoring-card is-correct-card">
            <div className="scoring-card-top">
              <span className="scoring-card-tag"><PlusCircle size={13} /> Correct Answers</span>
              <strong className="scoring-card-rate">+{session.marking.correct} each</strong>
            </div>
            <div className="scoring-card-calc">
              <span>{result.correct} × (+{session.marking.correct})</span>
              <strong className="scoring-card-val">+{correctMarksGained}</strong>
            </div>
          </div>

          <div className="training-scoring-card is-wrong-card">
            <div className="scoring-card-top">
              <span className="scoring-card-tag"><MinusCircle size={13} /> Negative Penalty</span>
              <strong className="scoring-card-rate">−{session.marking.wrong} each</strong>
            </div>
            <div className="scoring-card-calc">
              <span>{incorrectCount} × (−{session.marking.wrong})</span>
              <strong className="scoring-card-val">−{negativeMarksLost}</strong>
            </div>
          </div>

          <div className="training-scoring-card is-unattempted-card">
            <div className="scoring-card-top">
              <span className="scoring-card-tag"><HelpCircle size={13} /> Unattempted</span>
              <strong className="scoring-card-rate">0 each</strong>
            </div>
            <div className="scoring-card-calc">
              <span>{unattemptedCount} × 0</span>
              <strong className="scoring-card-val">0</strong>
            </div>
          </div>

          <div className="training-scoring-card is-net-card">
            <div className="scoring-card-top">
              <span className="scoring-card-tag"><Award size={13} /> Net Raw Score</span>
              <strong className="scoring-card-rate">Max {result.maxScore}</strong>
            </div>
            <div className="scoring-card-calc">
              <span>{correctMarksGained} − {negativeMarksLost}</span>
              <strong className="scoring-card-val net-val">{result.score}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="training-panel">
        <div className="training-panel-header">
          <h2>Your Next Strategic Adjustment</h2>
        </div>
        {["sprint", "survival"].includes(session.mode) && (
          <div className="training-mode-points-banner">
            <strong>{result.modePoints}</strong> training points · best streak{" "}
            <strong>{result.bestStreak}</strong> ·{" "}
            <strong>{result.questionsPerMinute}</strong> questions/min
          </div>
        )}
        <div className="training-findings-list">
          {result.findings.length ? (
            result.findings.map((f, i) => (
              <div key={i} className="training-finding-item">
                <span className="finding-bullet">•</span>
                <p>{f}</p>
              </div>
            ))
          ) : (
            <p className="training-empty-note">
              No major time-allocation issue detected in this session. Review
              uncertain answers before increasing difficulty.
            </p>
          )}
        </div>
      </section>

      {session.mode === "mission" && result.blockBreakdown?.length ? (
        <section className="training-panel">
          <div className="training-panel-header">
            <h2>Mission Block Breakdown</h2>
            <p className="training-panel-subtitle">
              Each block keeps its own training objective and behavior.
            </p>
          </div>
          {result.blockBreakdown.map((block) => (
            <div className="training-list-row" key={block.id}>
              <div>
                <strong>{block.label}</strong>
                <p>
                  {block.mode} · {block.attempted}/{block.questions} attempted ·{" "}
                  {block.averageSeconds}s average
                </p>
              </div>
              <strong>{block.accuracy}%</strong>
            </div>
          ))}
        </section>
      ) : null}

      <section className="training-panel">
        <div className="training-panel-header">
          <h2>Topic Breakdown</h2>
        </div>
        {result.masteryDelta && result.masteryDelta.length > 0 && (
          <div className="training-mastery-deltas">
            {result.masteryDelta.map((p) => (
              <div key={p.key} className="training-mastery-delta-pill">
                <span className="topic-name">{p.topic}:</span>
                <span className="mastery-val">{p.before}% → {p.after}%</span>
                <span className={`delta-val ${p.delta >= 0 ? "pos" : "neg"}`}>
                  ({p.delta > 0 ? "+" : ""}{p.delta} pts)
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="training-topic-rows">
          {topics.map((topic) => {
            const rows = result.rows.filter((r) => r.topic === topic);
            const correctCount = rows.filter((r) => r.correct).length;
            const pct = Math.round((correctCount / rows.length) * 100);
            return (
              <div className="training-topic-row" key={topic}>
                <div className="training-topic-info">
                  <strong>{topic}</strong>
                  <span className="training-topic-time">
                    {Math.round(rows.reduce((n, r) => n + r.seconds, 0))}s invested
                  </span>
                </div>
                <div className="training-topic-score">
                  <div className="training-topic-bar-bg">
                    <div
                      className="training-topic-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <strong>
                    {correctCount} / {rows.length} correct ({pct}%)
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="training-panel">
        <div className="training-panel-header">
          <h2>Failure Map</h2>
          <p className="training-panel-subtitle">
            Classify the reasons below. These are your tags to guide future review.
          </p>
        </div>
        <div className="training-failure-map">
          {Object.entries(result.failureMap)
            .filter(([, n]) => n > 0)
            .map(([name, n]) => (
              <span className="training-failure-tag" key={name}>
                <strong>{name}</strong>
                <span className="failure-count">{n}</span>
              </span>
            ))}
        </div>
        {!result.diagnosis ? (
          <div className="training-ai-diagnosis-action">
            <button
              data-ui-button="secondary"
              disabled={saving}
              onClick={suggest}
              className="training-ai-suggest-btn"
            >
              <Sparkles size={15} />
              <span>{saving ? "Diagnosing with AI…" : "Suggest mistake categories with AI"}</span>
            </button>
          </div>
        ) : (
          <div className="training-ai-diagnosis-box">
            <div className="diagnosis-note">
              <Sparkles size={16} />
              <p>{result.diagnosis.note}</p>
            </div>
            <div className="diagnosis-suggestions">
              {result.diagnosis.suggestions.map((s) => (
                <div className="training-diagnosis-item" key={s.questionId}>
                  <div className="diagnosis-item-content">
                    <strong>
                      Q
                      {
                        result.rows.find((r) => r.questionId === s.questionId)
                          ?.number
                      }
                      : <span className="cat-label">{s.category}</span>
                    </strong>
                    <p>{s.reason}</p>
                  </div>
                  <button
                    data-ui-button="secondary"
                    disabled={saving}
                    onClick={() => categorize(s.questionId, s.category)}
                  >
                    <Check size={14} />
                    <span>Use category</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div role="alert" className="training-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="training-panel">
        <div className="training-panel-header">
          <h2>Review Your Answers</h2>
          <p className="training-panel-subtitle">
            Click any question to view the full prompt, solutions, score impact, and adjust mistake reasons.
          </p>
        </div>
        <div className="training-reviews-list">
          {result.rows.map((row) => {
            const q = session.questions.find((q) => q.id === row.questionId)!;
            const statusClass = row.correct
              ? "status-correct"
              : row.attempted
                ? "status-incorrect"
                : "status-unanswered";
            const StatusIcon = row.correct
              ? Check
              : row.attempted
                ? X
                : AlertCircle;

            const scoreBadgeClass = row.correct
              ? "score-badge-pos"
              : row.attempted
                ? "score-badge-neg"
                : "score-badge-zero";

            const scoreDisplay = row.correct
              ? `+${row.score}`
              : row.score === 0
                ? "0"
                : `${row.score}`;

            return (
              <details className="training-answer-review" key={row.questionId}>
                <summary
                  aria-label={`Question ${row.number}: ${row.correct ? "Correct" : row.attempted ? "Incorrect" : "Unanswered"}, ${scoreDisplay} marks, ${Math.round(row.seconds)} seconds`}
                >
                  <div className="training-review-summary-left">
                    <span className={`training-review-status-badge ${statusClass}`}>
                      <StatusIcon size={13} />
                      Q{row.number} ·{" "}
                      {row.correct
                        ? "Correct"
                        : row.attempted
                          ? "Incorrect"
                          : "Unanswered"}
                    </span>
                    <span className={`training-review-score-pill ${scoreBadgeClass}`}>
                      {scoreDisplay} marks
                    </span>
                    <span className="training-review-topic">{row.topic}</span>
                  </div>
                  <div className="training-review-summary-right">
                    <span className="training-review-time">
                      <Clock size={13} />
                      {Math.round(row.seconds)}s / {row.target}s target
                    </span>
                  </div>
                </summary>

                <div className="training-review-body">
                  <div className="training-review-question-text">
                    <RichContent text={q.text} />
                    {q.image && (
                      <div className="training-review-image">
                        <RichContent text={`![Question illustration](${q.image})`} />
                      </div>
                    )}
                  </div>

                  <div className="training-review-answers-grid">
                    <div className={`training-review-choice-box ${row.correct ? "is-correct" : "is-wrong"}`}>
                      <span className="box-title">Your answer:</span>
                      <div className="box-content">
                        <RichContent
                          text={
                            row.choice === null ? "Left blank" : q.options[row.choice]
                          }
                        />
                      </div>
                    </div>

                    <div className="training-review-choice-box is-solution">
                      <span className="box-title">Correct answer:</span>
                      <div className="box-content">
                        <RichContent text={q.options[row.correctIndex]} />
                      </div>
                    </div>
                  </div>

                  {/* Question-level score impact banner */}
                  <div className={`training-review-score-banner ${row.correct ? "is-pos-impact" : row.attempted ? "is-neg-impact" : "is-zero-impact"}`}>
                    <div className="score-banner-icon">
                      {row.correct ? <PlusCircle size={15} /> : row.attempted ? <MinusCircle size={15} /> : <HelpCircle size={15} />}
                    </div>
                    <div className="score-banner-text">
                      <strong>
                        {row.correct
                          ? `+${row.score} Marks Awarded`
                          : row.attempted
                            ? `−${session.marking.wrong} Negative Penalty Applied`
                            : "0 Marks (Unattempted)"}
                      </strong>
                      <span>
                        {row.correct
                          ? `Full +${session.marking.correct} credit for correct choice.`
                          : row.attempted
                            ? `Official −${session.marking.wrong} penalty deducted for wrong answer.`
                            : "Skipped question — zero marks awarded and no negative penalty incurred."}
                      </span>
                    </div>
                  </div>

                  {row.solution && (
                    <div className="training-review-solution-box">
                      <span className="solution-title">Explanation:</span>
                      <RichContent text={row.solution} />
                    </div>
                  )}

                  <div className="training-review-meta-bar">
                    <span className="confidence-tag">
                      Confidence: <strong>{row.confidence ? row.confidence.toUpperCase() : "Not recorded"}</strong>
                    </span>

                    {row.attempted &&
                      (!row.correct ||
                        row.confidence !== "sure" ||
                        row.seconds > row.target * 1.5) && (
                        <label className="training-mistake-label">
                          <span>What happened?</span>
                          <select
                            aria-label={`Mistake category for question ${row.number}`}
                            value={row.mistake || ""}
                            disabled={saving}
                            onChange={(e) =>
                              categorize(row.questionId, e.target.value)
                            }
                          >
                            <option value="">Choose category…</option>
                            {mistakeTypes.map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                      )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
