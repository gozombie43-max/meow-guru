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
  BarChart3,
  BookOpen,
  Brain,
  Filter,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Flame,
  Shield,
  Layers,
  RotateCcw,
  TrendingUp,
  RotateCw,
} from "lucide-react";
import api from "@/shared/api/client";
import RichContent from "@/components/RichContent";
import katex from "katex";
import { mistakeTypes, modes, type TrainingSession, type ModeId } from "./training-types";

function renderScoreFraction(score: number, maxScore: number): string {
  try {
    const scoreStr = score > 0 ? `+${score}` : `${score}`;
    return katex.renderToString(`\\dfrac{${scoreStr}}{${maxScore}}`, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    return `${score} / ${maxScore}`;
  }
}

function ModeIcon({ mode }: { mode?: ModeId | string }) {
  switch (mode) {
    case "adaptive": return <Brain size={14} />;
    case "challenge": return <Target size={14} />;
    case "sprint": return <Zap size={14} />;
    case "pressure": return <Clock size={14} />;
    case "section": return <Layers size={14} />;
    case "gauntlet": return <Layers size={14} />;
    case "nightmare": return <Flame size={14} />;
    case "survival": return <Shield size={14} />;
    case "review": return <RotateCcw size={14} />;
    case "mission": return <Sparkles size={14} />;
    default: return <Brain size={14} />;
  }
}

export function TrainingResults({
  session,
  accept,
}: {
  session: TrainingSession;
  accept: (s: TrainingSession) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "review" | "insights">("overview");
  const [reviewFilter, setReviewFilter] = useState<"all" | "correct" | "incorrect" | "unanswered">("all");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
  const modeTitle = modes.find((m) => m.id === session.mode)?.title || "Practice Session";
  const examLabel = session.exam.replaceAll("-", " ").toUpperCase();

  // Filtered rows for Review tab
  const filteredRows = result.rows.filter((row) => {
    if (reviewFilter === "correct") return row.correct;
    if (reviewFilter === "incorrect") return row.attempted && !row.correct;
    if (reviewFilter === "unanswered") return !row.attempted;
    return true;
  });

  const toggleSingleRow = (qId: string) => {
    setExpandedMap((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const toggleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    for (const row of result.rows) {
      next[row.questionId] = expand;
    }
    setExpandedMap(next);
  };

  const isAllExpanded = result.rows.length > 0 && result.rows.every((r) => !!expandedMap[r.questionId]);

  // Performance Rating Badge
  const scorePercent = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const ratingBadge =
    scorePercent >= 80
      ? { text: "Outstanding Gain", variant: "is-outstanding" }
      : scorePercent >= 60
        ? { text: "Net Positive", variant: "is-positive" }
        : scorePercent >= 40
          ? { text: "Moderate Spread", variant: "is-moderate" }
          : { text: "Drawdown Risk", variant: "is-risk" };

  return (
    <div className="training-results-container">
      {/* ── Trading-style Performance Hero Panel ── */}
      <section className="trade-hero-panel">
        <div className="trade-hero-header">
          <div className="trade-hero-breadcrumbs">
            <span className="trade-mode-badge">
              <ModeIcon mode={session.mode} />
              {modeTitle}
            </span>
            <span className="trade-exam-tag">{examLabel}</span>
          </div>
          <span className={`trade-rating-pill ${ratingBadge.variant}`}>
            <TrendingUp size={13} />
            {ratingBadge.text}
          </span>
        </div>

        {/* Main P&L Showcase */}
        <div className="trade-pnl-headline">
          <div className="trade-pnl-main">
            <div className="trade-pnl-info">
              <span className="trade-pnl-label">NET SCORE (PNL)</span>
              <div className="trade-pnl-sub">
                <span className={`trade-pnl-percent ${scorePercent >= 50 ? "is-pos" : "is-neg"}`}>
                  {scorePercent}% Accuracy
                </span>
                <span className="trade-pnl-details">
                  (+{correctMarksGained} gain · −{negativeMarksLost} penalty)
                </span>
              </div>
            </div>

            {/* KaTeX Math Proper Fraction seamlessly on the Right Side */}
            <div
              className={`trade-math-fraction ${result.score > 0 ? "is-pos" : result.score < 0 ? "is-neg" : "is-zero"}`}
              dangerouslySetInnerHTML={{
                __html: renderScoreFraction(result.score, result.maxScore),
              }}
              aria-label={`Net Score: ${result.score} out of ${result.maxScore}`}
            />
          </div>

          {/* 4-Column KPI Stats Strip */}
          <div className="trade-kpi-strip">
            <button
              type="button"
              className="trade-kpi-item is-gain"
              onClick={() => {
                setActiveTab("review");
                setReviewFilter("correct");
              }}
              title="Filter correct questions"
            >
              <div className="kpi-tag"><PlusCircle size={13} /> Wins / Correct</div>
              <strong className="kpi-value">+{result.correct}</strong>
              <span className="kpi-note">+{correctMarksGained} marks</span>
            </button>

            <button
              type="button"
              className="trade-kpi-item is-loss"
              onClick={() => {
                setActiveTab("review");
                setReviewFilter("incorrect");
              }}
              title="Filter incorrect questions"
            >
              <div className="kpi-tag"><MinusCircle size={13} /> Loss / Wrong</div>
              <strong className="kpi-value">−{incorrectCount}</strong>
              <span className="kpi-note">−{negativeMarksLost} penalty</span>
            </button>

            <button
              type="button"
              className="trade-kpi-item is-neutral"
              onClick={() => {
                setActiveTab("review");
                setReviewFilter("unanswered");
              }}
              title="Filter skipped questions"
            >
              <div className="kpi-tag"><HelpCircle size={13} /> Skipped</div>
              <strong className="kpi-value">{unattemptedCount}</strong>
              <span className="kpi-note">0.00 penalty</span>
            </button>

            <div className="trade-kpi-item is-tempo">
              <div className="kpi-tag"><Clock size={13} /> Pace &amp; Speed</div>
              <strong className="kpi-value">{result.averageSeconds}s</strong>
              <span className="kpi-note">{result.accuracy}% acc</span>
            </div>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="trade-hero-actions">
          <Link replace data-ui-button="primary" href="/play" className="trade-action-cta">
            <RotateCw size={15} />
            <span>Practice Another Session</span>
          </Link>
          <button
            type="button"
            data-ui-button="secondary"
            className="trade-review-shortcut"
            onClick={() => setActiveTab("review")}
          >
            <BookOpen size={15} />
            <span>Review All {result.rows.length} Questions</span>
          </button>
        </div>
      </section>

      {/* ── Sleek Trading Navigation Sub-bar ── */}
      <nav className="trade-nav-tabs" aria-label="Results navigation">
        <button
          type="button"
          className={`trade-tab-btn ${activeTab === "overview" ? "is-active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <BarChart3 size={15} />
          <span>Settlement &amp; Analytics</span>
        </button>

        <button
          type="button"
          className={`trade-tab-btn ${activeTab === "review" ? "is-active" : ""}`}
          onClick={() => setActiveTab("review")}
        >
          <BookOpen size={15} />
          <span>Question Ledger</span>
          <span className="trade-tab-badge">{result.rows.length}</span>
        </button>

        <button
          type="button"
          className={`trade-tab-btn ${activeTab === "insights" ? "is-active" : ""}`}
          onClick={() => setActiveTab("insights")}
        >
          <Sparkles size={15} />
          <span>Mistakes &amp; AI</span>
          {incorrectCount > 0 && (
            <span className="trade-tab-badge is-alert">{incorrectCount}</span>
          )}
        </button>
      </nav>

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 1: SETTLEMENT & ANALYTICS
          ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="results-tab-content">
          {/* Official Score Settlement Table */}
          <section className="trade-section">
            <div className="trade-section-header">
              <div>
                <span className="trade-kicker">SETTLEMENT LEDGER</span>
                <h2>Official Score Breakdown &amp; Deductions</h2>
              </div>
              <div className="trade-marking-rules">
                <span className="trade-rule-pos">+{session.marking.correct} gain</span>
                <span className="trade-rule-neg">−{session.marking.wrong} loss</span>
                <span className="trade-rule-zero">0 skipped</span>
              </div>
            </div>

            <p className="trade-section-note">
              Official {examLabel} marking formula applied: Each incorrect answer incurs a <strong>−{session.marking.wrong} negative mark penalty</strong>.
              {session.marking.wrong > 0 && (
                <> Every <strong>{ratioToCancel} wrong answers</strong> cancel out <strong>1 full correct answer</strong>.</>
              )}
            </p>

            {/* Trading Settlement Statement Table */}
            <div className="trade-settlement-table">
              <div className="trade-settlement-row is-pos-row">
                <div className="trade-settlement-col-item">
                  <div className="trade-dot is-pos" />
                  <div>
                    <strong>Correct Positions (Wins)</strong>
                    <span>{result.correct} correct answers × (+{session.marking.correct} marks)</span>
                  </div>
                </div>
                <div className="trade-settlement-col-rate">+{session.marking.correct} / ans</div>
                <div className="trade-settlement-col-val is-pos">+{correctMarksGained}</div>
              </div>

              <div className="trade-settlement-row is-neg-row">
                <div className="trade-settlement-col-item">
                  <div className="trade-dot is-neg" />
                  <div>
                    <strong>Negative Penalty (Losses)</strong>
                    <span>{incorrectCount} wrong answers × (−{session.marking.wrong} marks)</span>
                  </div>
                </div>
                <div className="trade-settlement-col-rate">−{session.marking.wrong} / ans</div>
                <div className="trade-settlement-col-val is-neg">−{negativeMarksLost}</div>
              </div>

              <div className="trade-settlement-row is-zero-row">
                <div className="trade-settlement-col-item">
                  <div className="trade-dot is-zero" />
                  <div>
                    <strong>Unattempted / Skipped</strong>
                    <span>{unattemptedCount} left blank (no penalty)</span>
                  </div>
                </div>
                <div className="trade-settlement-col-rate">0.00 / ans</div>
                <div className="trade-settlement-col-val is-zero">0.00</div>
              </div>

              <div className="trade-settlement-row is-total-row">
                <div className="trade-settlement-col-item">
                  <Award size={18} className="trade-total-icon" />
                  <div>
                    <strong>Net Settled Score</strong>
                    <span>Gross credit (+{correctMarksGained}) − penalties (−{negativeMarksLost})</span>
                  </div>
                </div>
                <div className="trade-settlement-col-rate">Max {result.maxScore}</div>
                <div className="trade-settlement-col-val is-total">
                  <span
                    className="trade-math-fraction-settlement"
                    dangerouslySetInnerHTML={{
                      __html: renderScoreFraction(result.score, result.maxScore),
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Sector / Topic Performance */}
          <section className="trade-section">
            <div className="trade-section-header">
              <div>
                <span className="trade-kicker">SECTOR BREAKDOWN</span>
                <h2>Topic Performance &amp; Mastery Gains</h2>
              </div>
            </div>

            {result.masteryDelta && result.masteryDelta.length > 0 && (
              <div className="trade-mastery-ribbon">
                {result.masteryDelta.map((p) => (
                  <div key={p.key} className="trade-mastery-chip">
                    <span className="chip-topic">{p.topic}:</span>
                    <span className="chip-prog">{p.before}% → {p.after}%</span>
                    <span className={`chip-delta ${p.delta >= 0 ? "is-pos" : "is-neg"}`}>
                      ({p.delta > 0 ? "+" : ""}{p.delta} pts)
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="trade-topic-ledger">
              {topics.map((topic) => {
                const rows = result.rows.filter((r) => r.topic === topic);
                const correctCount = rows.filter((r) => r.correct).length;
                const pct = Math.round((correctCount / rows.length) * 100);
                return (
                  <div className="trade-topic-entry" key={topic}>
                    <div className="trade-topic-left">
                      <strong>{topic}</strong>
                      <span className="trade-topic-sub">
                        {Math.round(rows.reduce((n, r) => n + r.seconds, 0))}s invested · {rows.length} questions
                      </span>
                    </div>
                    <div className="trade-topic-right">
                      <div className="trade-topic-bar">
                        <div
                          className={`trade-topic-bar-fill ${pct >= 70 ? "is-pos" : pct >= 40 ? "is-mid" : "is-low"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="trade-topic-ratio">
                        <strong>{correctCount}/{rows.length}</strong> ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Strategy Findings */}
          <section className="trade-section">
            <div className="trade-section-header">
              <div>
                <span className="trade-kicker">EXECUTION LOG</span>
                <h2>Strategy &amp; Next Action Adjustments</h2>
              </div>
            </div>
            {["sprint", "survival"].includes(session.mode) && (
              <div className="trade-mode-banner">
                <strong>{result.modePoints}</strong> points · Best streak{" "}
                <strong>{result.bestStreak}</strong> ·{" "}
                <strong>{result.questionsPerMinute}</strong> Q/min
              </div>
            )}
            <div className="trade-findings-list">
              {result.findings.length ? (
                result.findings.map((f, i) => (
                  <div key={i} className="trade-finding-row">
                    <span className="finding-indicator">•</span>
                    <p>{f}</p>
                  </div>
                ))
              ) : (
                <p className="trade-empty-note">
                  No major time-allocation issue detected in this session. Review
                  uncertain answers before increasing difficulty.
                </p>
              )}
            </div>
          </section>

          {/* Mission Block Breakdown */}
          {session.mode === "mission" && result.blockBreakdown?.length ? (
            <section className="trade-section">
              <div className="trade-section-header">
                <div>
                  <span className="trade-kicker">MISSION PROTOCOL</span>
                  <h2>Mission Block Breakdown</h2>
                </div>
              </div>
              <div className="trade-topic-ledger">
                {result.blockBreakdown.map((block) => (
                  <div className="trade-topic-entry" key={block.id}>
                    <div className="trade-topic-left">
                      <strong>{block.label}</strong>
                      <span className="trade-topic-sub">
                        {block.mode} · {block.attempted}/{block.questions} attempted · {block.averageSeconds}s avg
                      </span>
                    </div>
                    <div className="trade-topic-right">
                      <span className="trade-topic-ratio">
                        <strong>{block.accuracy}%</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 2: QUESTION REVIEW (TRADE LEDGER)
          ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "review" && (
        <div className="results-tab-content trade-review-container">
          {/* Filter Bar */}
          <div className="trade-filter-bar">
            <div className="trade-filter-group">
              <button
                type="button"
                className={`trade-filter-tab ${reviewFilter === "all" ? "is-active" : ""}`}
                onClick={() => setReviewFilter("all")}
              >
                All ({result.rows.length})
              </button>
              <button
                type="button"
                className={`trade-filter-tab is-loss ${reviewFilter === "incorrect" ? "is-active" : ""}`}
                onClick={() => setReviewFilter("incorrect")}
              >
                <MinusCircle size={13} /> Losses ({incorrectCount})
              </button>
              <button
                type="button"
                className={`trade-filter-tab is-gain ${reviewFilter === "correct" ? "is-active" : ""}`}
                onClick={() => setReviewFilter("correct")}
              >
                <PlusCircle size={13} /> Wins ({result.correct})
              </button>
              <button
                type="button"
                className={`trade-filter-tab is-zero ${reviewFilter === "unanswered" ? "is-active" : ""}`}
                onClick={() => setReviewFilter("unanswered")}
              >
                <HelpCircle size={13} /> Skipped ({unattemptedCount})
              </button>
            </div>

            <button
              type="button"
              className="trade-expand-all-btn"
              onClick={() => toggleExpandAll(!isAllExpanded)}
            >
              {isAllExpanded ? (
                <>
                  <ChevronUp size={14} /> Collapse all
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Expand all
                </>
              )}
            </button>
          </div>

          {filteredRows.length === 0 ? (
            <div className="trade-empty-state">
              <p>No questions match "{reviewFilter}".</p>
              <button
                type="button"
                data-ui-button="secondary"
                onClick={() => setReviewFilter("all")}
              >
                Show all questions
              </button>
            </div>
          ) : (
            <div className="trade-ledger-list">
              {filteredRows.map((row) => {
                const q = session.questions.find((q) => q.id === row.questionId)!;
                const isExpanded = !!expandedMap[row.questionId];
                const outcomeClass = row.correct
                  ? "is-gain"
                  : row.attempted
                    ? "is-loss"
                    : "is-zero";

                const scoreFormatted = row.correct
                  ? `+${row.score}`
                  : row.score === 0
                    ? "0.00"
                    : `${row.score}`;

                return (
                  <div
                    className={`trade-ledger-item ${outcomeClass} ${isExpanded ? "is-open" : ""}`}
                    key={row.questionId}
                  >
                    <button
                      type="button"
                      className="trade-ledger-item-header"
                      onClick={() => toggleSingleRow(row.questionId)}
                      aria-expanded={isExpanded}
                    >
                      <div className="trade-ledger-meta">
                        <span className={`trade-score-tag ${outcomeClass}`}>
                          {scoreFormatted} pts
                        </span>
                        <strong className="trade-q-title">Q{row.number}</strong>
                        <span className="trade-topic-tag">{row.topic}</span>
                      </div>

                      <div className="trade-ledger-right">
                        <span className="trade-time-tag">
                          <Clock size={12} />
                          {Math.round(row.seconds)}s
                        </span>
                        <span className="trade-chevron">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="trade-ledger-body">
                        {/* Question Text */}
                        <div className="trade-q-text">
                          <RichContent text={q.text} />
                          {q.image && (
                            <div className="trade-q-image">
                              <RichContent text={`![Question illustration](${q.image})`} />
                            </div>
                          )}
                        </div>

                        {/* Comparative Choices */}
                        <div className="trade-choices-comparison">
                          <div className={`trade-choice-row ${row.correct ? "is-correct-pick" : "is-wrong-pick"}`}>
                            <span className="choice-label">Your Answer:</span>
                            <div className="choice-value">
                              <RichContent
                                text={
                                  row.choice === null ? "Left blank (Skipped)" : q.options[row.choice]
                                }
                              />
                            </div>
                          </div>

                          <div className="trade-choice-row is-official-pick">
                            <span className="choice-label">Correct Solution:</span>
                            <div className="choice-value">
                              <RichContent text={q.options[row.correctIndex]} />
                            </div>
                          </div>
                        </div>

                        {/* Score Impact Note */}
                        <div className={`trade-impact-note ${outcomeClass}`}>
                          <strong>
                            {row.correct
                              ? `+${row.score} Marks Awarded`
                              : row.attempted
                                ? `−${session.marking.wrong} Negative Penalty Applied`
                                : "0.00 Marks (Unattempted)"}
                          </strong>
                          <span>
                            {row.correct
                              ? `Full +${session.marking.correct} credit granted.`
                              : row.attempted
                                ? `Official −${session.marking.wrong} negative marking penalty deducted.`
                                : "Skipped position with zero mark penalty."}
                          </span>
                        </div>

                        {/* Solution Explanation */}
                        {row.solution && (
                          <div className="trade-solution-callout">
                            <span className="solution-head">Explanation:</span>
                            <RichContent text={row.solution} />
                          </div>
                        )}

                        {/* Meta bar & mistake category */}
                        <div className="trade-item-footer">
                          <span className="trade-conf-tag">
                            Confidence: <strong>{row.confidence ? row.confidence.toUpperCase() : "Not recorded"}</strong>
                          </span>

                          {row.attempted &&
                            (!row.correct ||
                              row.confidence !== "sure" ||
                              row.seconds > row.target * 1.5) && (
                              <label className="trade-mistake-select-label">
                                <span>Categorize mistake:</span>
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 3: MISTAKES & AI DIAGNOSTICS
          ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "insights" && (
        <div className="results-tab-content">
          <section className="trade-section">
            <div className="trade-section-header">
              <div>
                <span className="trade-kicker">ERROR ANALYSIS</span>
                <h2>Failure Classification &amp; AI Diagnosis</h2>
              </div>
            </div>

            <p className="trade-section-note">
              Categorize hesitant or incorrect responses to strengthen spaced repetition patterns.
            </p>

            <div className="trade-failure-tags">
              {Object.entries(result.failureMap).filter(([, n]) => n > 0).length === 0 ? (
                <p className="trade-empty-note">
                  No mistakes categorized yet. Categorize questions in the Question Ledger or click below to run AI diagnosis.
                </p>
              ) : (
                Object.entries(result.failureMap)
                  .filter(([, n]) => n > 0)
                  .map(([name, n]) => (
                    <span className="trade-failure-chip" key={name}>
                      <strong>{name}</strong>
                      <span className="chip-count">{n}</span>
                    </span>
                  ))
              )}
            </div>

            {!result.diagnosis ? (
              <div className="trade-ai-action-wrap">
                <button
                  data-ui-button="secondary"
                  disabled={saving}
                  onClick={suggest}
                  className="trade-ai-suggest-btn"
                >
                  <Sparkles size={15} />
                  <span>{saving ? "Diagnosing with AI…" : "Suggest mistake categories with AI"}</span>
                </button>
              </div>
            ) : (
              <div className="trade-ai-diagnosis-container">
                <div className="trade-diagnosis-head">
                  <Sparkles size={16} />
                  <p>{result.diagnosis.note}</p>
                </div>
                <div className="trade-diagnosis-list">
                  {result.diagnosis.suggestions.map((s) => (
                    <div className="trade-diagnosis-card" key={s.questionId}>
                      <div className="diagnosis-content">
                        <strong>
                          Q
                          {
                            result.rows.find((r) => r.questionId === s.questionId)
                              ?.number
                          }
                          : <span className="cat-pill">{s.category}</span>
                        </strong>
                        <p>{s.reason}</p>
                      </div>
                      <button
                        data-ui-button="secondary"
                        disabled={saving}
                        onClick={() => categorize(s.questionId, s.category)}
                      >
                        <Check size={14} />
                        <span>Apply</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {error && (
        <div role="alert" className="training-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
