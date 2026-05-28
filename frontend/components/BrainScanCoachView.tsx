// frontend/components/BrainScanCoachView.tsx
// QuizGuru - Brain Scan coaching view

"use client";

import { useEffect } from "react";
import { useBrainScan, WeakConcept } from "@/hooks/useCognitiveMapper";

type DimensionMeta = {
  label: string;
  color: string;
  bg: string;
  accent: string;
  summary: string;
};

const DIMENSION_META: Record<string, DimensionMeta> = {
  CONCEPTUAL_GAP: {
    label: "Conceptual gap",
    color: "#9A3412",
    bg: "#FFF4EC",
    accent: "#F97316",
    summary: "The rule is missing or not stable yet.",
  },
  APPLICATION_ERROR: {
    label: "Application error",
    color: "#166534",
    bg: "#ECFDF3",
    accent: "#22C55E",
    summary: "You know the idea, but the method breaks while solving.",
  },
  TRAP_CAUGHT: {
    label: "Trap caught",
    color: "#075985",
    bg: "#ECFEFF",
    accent: "#06B6D4",
    summary: "A distractor or shortcut looked more convincing than it should.",
  },
  SPEED_PANIC: {
    label: "Speed panic",
    color: "#7C2D12",
    bg: "#FFF7ED",
    accent: "#FB923C",
    summary: "Time pressure or answer switching caused the miss.",
  },
  BLIND_SPOT: {
    label: "Blind spot",
    color: "#4338CA",
    bg: "#EEF2FF",
    accent: "#6366F1",
    summary: "You skipped, guessed, or moved too fast to engage the question.",
  },
};

const FALLBACK_META: DimensionMeta = {
  label: "Unclear pattern",
  color: "#475569",
  bg: "#F8FAFC",
  accent: "#94A3B8",
  summary: "This pattern still needs more attempts to classify well.",
};

const DIMENSION_ORDER = [
  "CONCEPTUAL_GAP",
  "APPLICATION_ERROR",
  "TRAP_CAUGHT",
  "SPEED_PANIC",
  "BLIND_SPOT",
];

const EMPTY_DISTRIBUTION = DIMENSION_ORDER.reduce<Record<string, number>>((acc, key) => {
  acc[key] = 0;
  return acc;
}, {});

const PRESCRIPTION: Record<string, string> = {
  CONCEPTUAL_GAP: "Study the concept first, then do 10 easy questions.",
  APPLICATION_ERROR: "Do 15 medium questions with step-by-step solution review.",
  TRAP_CAUGHT: "Practice 10 misleading SSC-style questions and explain the trap.",
  SPEED_PANIC: "Solve 10 timed questions and do not change the first answer.",
  BLIND_SPOT: "Force yourself to explain the question before answering.",
};

interface Props {
  userId: string;
}

function getDimensionMeta(dimension: string) {
  return DIMENSION_META[dimension] || FALLBACK_META;
}

function formatLastSeen(iso?: string) {
  if (!iso) return "No recent attempt";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No recent attempt";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSeverity(totalWrong: number) {
  if (totalWrong >= 5) return { label: "Critical", color: "#B42318", bg: "#FEF3F2" };
  if (totalWrong >= 3) return { label: "Priority", color: "#B54708", bg: "#FFFAEB" };
  return { label: "Watch", color: "#4338CA", bg: "#EEF2FF" };
}

function getDataDepth(totalFailures: number) {
  if (totalFailures >= 12) return { label: "Stable signal", detail: "Enough misses for a dependable pattern." };
  if (totalFailures >= 5) return { label: "Growing signal", detail: "Useful trend, but still expanding." };
  return { label: "Early signal", detail: "A small sample is shaping the current scan." };
}

function getWeaknessSpread(activeDimensions: number) {
  if (activeDimensions >= 4) return { label: "Scattered", detail: "Misses are spread across multiple failure modes." };
  if (activeDimensions >= 2) return { label: "Mixed", detail: "A few failure modes are active together." };
  return { label: "Focused", detail: "Most misses point to one dominant issue." };
}

function getLatestWeakConcept(concepts: WeakConcept[]) {
  return concepts.reduce<WeakConcept | null>((latest, concept) => {
    if (!latest) return concept;
    const latestTime = Date.parse(latest.lastSeen || "") || 0;
    const conceptTime = Date.parse(concept.lastSeen || "") || 0;
    return conceptTime > latestTime ? concept : latest;
  }, null);
}

function formatCountLabel(count: number) {
  return `${count} wrong${count === 1 ? "" : "s"}`;
}

export default function BrainScanCoachView({ userId }: Props) {
  const { data, loading, fetchBrainScan } = useBrainScan(userId);

  useEffect(() => {
    fetchBrainScan();
  }, [fetchBrainScan]);

  if (loading) {
    return (
      <div className="coach-shell coach-loading">
        <div className="scan-orb">◌</div>
        <p>Building your failure coach...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="coach-shell coach-empty">
        <p className="empty-title">Your failure coach will appear after practice.</p>
        <p className="empty-copy">Answer more questions and this view will tell you what failed, why it failed, and what to drill next.</p>
      </div>
    );
  }

  const distribution = data.globalDistribution || EMPTY_DISTRIBUTION;
  const dimensionRows = DIMENSION_ORDER.map((dimension) => [dimension, distribution[dimension] || 0] as const);
  const totalFailures = dimensionRows.reduce((sum, [, count]) => sum + count, 0);
  const activeDimensions = dimensionRows.filter(([, count]) => count > 0).length;
  const dominant = dimensionRows.slice().sort((a, b) => b[1] - a[1])[0] || ["APPLICATION_ERROR", 0];
  const dominantMeta = getDimensionMeta(dominant[0]);
  const dominantPct = totalFailures > 0 ? Math.round((dominant[1] / totalFailures) * 100) : 0;
  const weaknessSpread = getWeaknessSpread(activeDimensions);
  const dataDepth = getDataDepth(totalFailures);
  const sourceLabel =
    data.source === "recentQuizzes"
      ? "Based on recent quizzes"
      : data.source === "failureMap"
        ? "Based on your failure map"
        : "Practice history only";
  const insights = data.insights;
  const adaptiveNextDrill = insights?.adaptiveNextDrill;
  const mistakeCoach = insights?.mistakeCoach || [];
  const subjectHeatmap = insights?.subjectHeatmap || [];
  const confidenceProfile = insights?.confidenceProfile;
  const revisionPack = insights?.revisionPack || [];
  const trapRadar = insights?.trapRadar;
  const progressNarrative = insights?.progressNarrative;
  const latestWeakConcept = getLatestWeakConcept(data.topWeakConcepts);
  const topCoachItem = mistakeCoach[0];
  const headlineConcept = latestWeakConcept?.concept || adaptiveNextDrill?.concept || dominantMeta.label;
  const nextDrillLabel = adaptiveNextDrill
    ? `${adaptiveNextDrill.count} ${adaptiveNextDrill.difficulty} questions on ${adaptiveNextDrill.concept}`
    : "A focused drill will be suggested after more attempts.";
  const nextDrillReason = adaptiveNextDrill?.reason || topCoachItem?.why || dominantMeta.summary;
  const nextDrillFocus = adaptiveNextDrill?.focus || topCoachItem?.fix || "Work one concept at a time and review every miss.";
  const progressCopy = progressNarrative?.detail || "The scan will sharpen as you keep practicing.";
  const priorityTargets = data.topWeakConcepts.slice(0, 4);

  if (totalFailures === 0 && data.topWeakConcepts.length === 0) {
    return (
      <div className="coach-shell coach-empty">
        <p className="empty-title">No wrong answers tracked yet.</p>
        <p className="empty-copy">Once you answer a few questions, Brain Scan will point out the failure pattern and tell you how to fix it.</p>
      </div>
    );
  }

  return (
    <div className="coach-shell">
      <header className="coach-hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">Failure coach</p>
          <h2>Fix the pattern that is costing you marks.</h2>
          <p className="hero-detail">
            {progressNarrative?.headline || "This view tells you what failed, why it keeps happening, and what to do next."}
          </p>
          <div className="hero-meta">
            <span>{data.topWeakConcepts.length} concepts tracked</span>
            <span>{totalFailures} failures analyzed</span>
            <span>{sourceLabel}</span>
          </div>
        </div>

        <div className="hero-card hero-card-main">
          <div className="hero-card-top">
            <span className="hero-badge" style={{ background: dominantMeta.bg, color: dominantMeta.color }}>
              {dominantMeta.label}
            </span>
            <span className="hero-subtle">{dominantPct}% of tracked misses</span>
          </div>
          <strong className="hero-concept">{headlineConcept}</strong>
          <p className="hero-copy-text">{topCoachItem?.why || nextDrillReason}</p>
          <div className="hero-action">
            <span>Immediate fix</span>
            <p>{topCoachItem?.fix || nextDrillFocus}</p>
          </div>
        </div>
      </header>

      <nav className="scan-nav" aria-label="Brain Scan sections">
        <a href="#today-plan" className="scan-chip">Today&apos;s plan</a>
        <a href="#failure-patterns" className="scan-chip">Why it happens</a>
        <a href="#subject-patterns" className="scan-chip">Subject patterns</a>
        <a href="#revision-guardrails" className="scan-chip">Revision guardrails</a>
        <a href="#priority-targets" className="scan-chip">Priority targets</a>
      </nav>

      <section id="today-plan" className="coach-grid">
        <article className="coach-panel coach-panel-accent">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Today&apos;s drill</p>
              <h3>{adaptiveNextDrill ? adaptiveNextDrill.drillType : "Build the next drill from the current weakness"}</h3>
            </div>
            <span className="panel-pill">{adaptiveNextDrill?.difficulty || "medium"}</span>
          </div>
          <p className="panel-copy">{nextDrillLabel}</p>
          <p className="panel-note">{nextDrillReason}</p>
          <div className="step-list">
            <span>1. Solve without changing the first answer.</span>
            <span>2. Mark the reason for every miss.</span>
            <span>3. Review the solution line by line.</span>
          </div>
        </article>

        <article className="coach-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Confidence and pace</p>
              <h3>{confidenceProfile?.label || "Balanced"}</h3>
            </div>
            <span className="panel-pill">{confidenceProfile?.skipRate ?? 0}% skip</span>
          </div>
          <p className="panel-copy">{confidenceProfile?.detail || "Your speed and accuracy are still settling."}</p>
          <div className="metric-stack">
            <div className="metric-row">
              <span>Fast wrong</span>
              <strong>{confidenceProfile?.fastWrongRate ?? 0}%</strong>
            </div>
            <div className="metric-row">
              <span>Average wrong time</span>
              <strong>{confidenceProfile?.avgWrongTime ?? 0}s</strong>
            </div>
            <div className="metric-row">
              <span>Average correct time</span>
              <strong>{confidenceProfile?.avgCorrectTime ?? 0}s</strong>
            </div>
          </div>
        </article>

        <article className="coach-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Progress signal</p>
              <h3>{progressNarrative?.headline || "Baseline set"}</h3>
            </div>
            <span className="panel-pill">{dataDepth.label}</span>
          </div>
          <p className="panel-copy">{progressCopy}</p>
          <div className="signal-row">
            <span>{weaknessSpread.label}</span>
            <strong>{weaknessSpread.detail}</strong>
          </div>
          <div className="signal-row">
            <span>Latest signal</span>
            <strong>{latestWeakConcept?.concept || "Current attempt"}</strong>
          </div>
          <div className="signal-row">
            <span>Last seen</span>
            <strong>{formatLastSeen(latestWeakConcept?.lastSeen || data.lastActiveDate)}</strong>
          </div>
        </article>
      </section>

      <section id="failure-patterns" className="coaching-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Why this keeps happening</p>
            <h3>Root cause notes</h3>
          </div>
          <span>Short, direct fixes</span>
        </div>
        {mistakeCoach.length > 0 ? (
          <div className="stack-grid">
            {mistakeCoach.map((item, index) => {
              const meta = getDimensionMeta(item.dimension);
              return (
                <article key={`${index}-${item.concept}-${item.dimension}`} className="reason-card">
                  <div className="reason-head">
                    <strong>{item.concept}</strong>
                    <span style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                  <p className="reason-copy">{item.why}</p>
                  <div className="reason-fix">{item.fix}</div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-panel">No coaching notes yet. Add more attempts to unlock them.</div>
        )}
      </section>

      <section id="subject-patterns" className="coaching-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Mistake map</p>
            <h3>Subject and topic patterns</h3>
          </div>
          <span>Where the misses cluster</span>
        </div>
        {subjectHeatmap.length > 0 ? (
          <div className="stack-grid">
            {subjectHeatmap.map((subject, subjectIndex) => (
              <article key={`${subjectIndex}-${subject.subject}`} className="heat-card">
                <div className="heat-head">
                  <strong>{subject.subject}</strong>
                  <span>{formatCountLabel(subject.totalWrong)}</span>
                </div>
                <div className="topic-grid">
                  {subject.topics.map((topic, topicIndex) => {
                    const share = subject.totalWrong > 0 ? Math.round((topic.totalWrong / subject.totalWrong) * 100) : 0;
                    return (
                      <div key={`${subjectIndex}-${topicIndex}-${topic.topic}`} className="topic-card">
                        <div className="topic-top">
                          <strong>{topic.topic}</strong>
                          <span>{topic.totalWrong}</span>
                        </div>
                        <p>{topic.concepts} concepts · {topic.avgTime}s avg</p>
                        <div className="topic-track" aria-hidden="true">
                          <div className="topic-fill" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">No subject heatmap is available yet.</div>
        )}
      </section>

      <section id="revision-guardrails" className="coach-grid coach-grid-tight">
        <article className="coach-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Revision pack</p>
              <h3>{revisionPack.length} focused drills</h3>
            </div>
            <span className="panel-pill">Next review set</span>
          </div>
          {revisionPack.length > 0 ? (
            <div className="stack-list">
              {revisionPack.map((item, index) => (
                <div key={`${index}-${item.subject}-${item.concept}`} className="list-item">
                  <div className="list-top">
                    <strong>{item.concept}</strong>
                    <span>{item.drillSize} Qs</span>
                  </div>
                  <p>{item.subject} · {item.topic}</p>
                  <div className="list-note">{item.drillType}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">No revision pack yet.</div>
          )}
        </article>

        <article className="coach-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Trap radar</p>
              <h3>{trapRadar?.label || "Low trap pressure"}</h3>
            </div>
            <span className="panel-pill">{trapRadar?.trapShare ?? 0}% trap share</span>
          </div>
          <p className="panel-copy">{trapRadar?.detail || "Trap misses are not dominating the scan."}</p>
          {trapRadar?.hotspots?.length ? (
            <div className="stack-list">
              {trapRadar.hotspots.map((item, index) => (
                <div key={`${index}-${item.topic}-${item.concept}`} className="list-item">
                  <div className="list-top">
                    <strong>{item.concept}</strong>
                    <span>{item.hits} hits</span>
                  </div>
                  <p>{item.topic}</p>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section id="priority-targets" className="coaching-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Priority targets</p>
            <h3>Weak concepts to fix first</h3>
          </div>
          <span>Highest-risk concepts in the scan</span>
        </div>

        {priorityTargets.length > 0 ? (
          <div className="target-grid">
            {priorityTargets.map((concept) => {
              const meta = getDimensionMeta(concept.dominantDimension);
              const severity = getSeverity(concept.totalWrong);
              const share = totalFailures > 0 ? Math.round((concept.totalWrong / totalFailures) * 100) : 0;

              return (
                <article key={concept.key} className="target-card">
                  <div className="target-head">
                    <div>
                      <p className="target-topic">{concept.topic}</p>
                      <h4>{concept.concept}</h4>
                    </div>
                    <span className="target-badge" style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="target-meta">
                    <span>{formatCountLabel(concept.totalWrong)}</span>
                    <span style={{ background: severity.bg, color: severity.color }}>{severity.label}</span>
                  </div>
                  <div className="share-wrap">
                    <div className="share-top">
                      <span>Share of scan</span>
                      <strong>{share}%</strong>
                    </div>
                    <div className="share-track" aria-hidden="true">
                      <div className="share-fill" style={{ width: `${share}%`, background: meta.accent }} />
                    </div>
                  </div>
                  <div className="target-prescription">
                    <strong>Do next:</strong> {PRESCRIPTION[concept.dominantDimension] || "Repeat the concept with solution review."}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-panel">No weak concepts found in the current attempts.</div>
        )}
      </section>

      <style>{`
        .coach-shell {
          color: #102033;
          background:
            radial-gradient(circle at top left, rgba(251, 146, 60, 0.14), transparent 28%),
            radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 24%),
            linear-gradient(180deg, #fffaf4 0%, #f5efe7 100%);
          border-radius: 24px;
          padding: 18px;
        }

        .coach-loading,
        .coach-empty {
          min-height: 220px;
          display: grid;
          place-items: center;
          text-align: center;
        }

        .scan-orb {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.8);
          font-size: 2rem;
          animation: floaty 1.8s ease-in-out infinite;
          margin-bottom: 0.75rem;
        }

        @keyframes floaty {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-6px);
          }
        }

        .empty-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 800;
        }

        .empty-copy {
          margin: 0.4rem 0 0;
          color: #617286;
          max-width: 48ch;
          line-height: 1.55;
        }

        .coach-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
          gap: 14px;
          margin-bottom: 14px;
        }

        .hero-copy,
        .hero-card,
        .coach-panel,
        .reason-card,
        .heat-card,
        .target-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 16px 40px rgba(16, 32, 51, 0.07);
        }

        .hero-copy {
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 220px;
        }

        .hero-eyebrow,
        .panel-kicker,
        .section-kicker {
          margin: 0 0 6px;
          color: #8b5e34;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .hero-copy h2 {
          margin: 0;
          max-width: 16ch;
          font-size: clamp(1.7rem, 4vw, 3rem);
          line-height: 0.98;
          letter-spacing: -0.04em;
        }

        .hero-detail {
          margin: 0.9rem 0 0;
          color: #617286;
          max-width: 54ch;
          font-size: 0.98rem;
          line-height: 1.6;
        }

        .hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }

        .hero-meta span,
        .scan-chip,
        .panel-pill,
        .target-badge,
        .hero-badge,
        .target-meta span,
        .reason-head span,
        .list-top span,
        .heat-head span,
        .topic-top span,
        .share-top strong,
        .signal-row span,
        .hero-subtle {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.75rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .hero-meta span {
          background: rgba(255, 255, 255, 0.82);
          color: #334155;
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .hero-card {
          border-radius: 24px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 220px;
        }

        .hero-card-top,
        .panel-head,
        .section-head,
        .reason-head,
        .heat-head,
        .topic-top,
        .target-head,
        .target-meta,
        .list-top,
        .share-top,
        .signal-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .hero-concept {
          font-size: 1.2rem;
          line-height: 1.2;
          letter-spacing: -0.03em;
        }

        .hero-copy-text,
        .hero-action p,
        .panel-copy,
        .panel-note,
        .reason-copy,
        .reason-fix,
        .list-item p,
        .target-prescription,
        .empty-panel {
          margin: 0;
          color: #617286;
          line-height: 1.55;
          font-size: 0.92rem;
        }

        .hero-action {
          padding-top: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .hero-action span,
        .panel-kicker,
        .section-kicker {
          display: block;
        }

        .hero-action p {
          color: #102033;
          margin-top: 6px;
          font-weight: 700;
        }

        .scan-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .scan-chip {
          text-decoration: none;
          color: #334155;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 8px 24px rgba(16, 32, 51, 0.04);
        }

        .coach-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 14px;
        }

        .coach-grid-tight {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .coach-panel {
          border-radius: 22px;
          padding: 18px;
        }

        .coach-panel-accent {
          background: linear-gradient(180deg, rgba(255, 248, 239, 0.92), rgba(255, 255, 255, 0.9));
        }

        .panel-head {
          margin-bottom: 12px;
        }

        .panel-head h3,
        .section-head h3 {
          margin: 0;
          font-size: 1.05rem;
          letter-spacing: -0.03em;
        }

        .panel-note {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #102033;
          font-weight: 600;
        }

        .step-list,
        .metric-stack,
        .stack-list,
        .stack-grid,
        .target-grid,
        .topic-grid {
          display: grid;
          gap: 10px;
        }

        .step-list span {
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #102033;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .metric-row,
        .signal-row {
          padding: 10px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .metric-row:last-child,
        .signal-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .metric-row span,
        .signal-row span {
          color: #64748b;
          background: transparent;
          border: 0;
          padding: 0;
        }

        .metric-row strong,
        .signal-row strong {
          color: #102033;
          background: transparent;
          border: 0;
          padding: 0;
          white-space: normal;
          text-align: right;
        }

        .coaching-section {
          margin-bottom: 14px;
        }

        .section-head {
          margin-bottom: 10px;
        }

        .section-head span {
          color: #8a94a7;
          font-size: 0.78rem;
          font-weight: 700;
          align-self: center;
        }

        .reason-card,
        .heat-card,
        .target-card {
          border-radius: 20px;
          padding: 16px;
        }

        .reason-head strong,
        .heat-head strong,
        .topic-top strong,
        .target-head h4,
        .list-top strong {
          color: #102033;
          font-size: 0.94rem;
          font-weight: 800;
        }

        .reason-head span,
        .target-badge {
          color: #334155;
        }

        .reason-copy {
          margin-top: 10px;
        }

        .reason-fix,
        .list-note,
        .target-prescription {
          margin-top: 10px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #102033;
          font-weight: 700;
        }

        .topic-grid {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          margin-top: 12px;
        }

        .topic-card {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.74);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .topic-card p {
          margin: 6px 0 10px;
          color: #617286;
          font-size: 0.82rem;
        }

        .topic-track,
        .share-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
        }

        .topic-fill,
        .share-fill {
          height: 100%;
          border-radius: 999px;
        }

        .target-grid {
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }

        .target-card h4 {
          margin: 4px 0 0;
          line-height: 1.25;
        }

        .target-topic {
          margin: 0;
          color: #7c2d12;
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .target-meta {
          margin-top: 12px;
        }

        .target-meta span {
          border-color: rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.78);
        }

        .share-wrap {
          margin-top: 12px;
        }

        .share-top {
          margin-bottom: 6px;
        }

        .share-top span {
          color: #64748b;
          background: transparent;
          border: 0;
          padding: 0;
        }

        .share-top strong {
          color: #102033;
          background: transparent;
          border: 0;
          padding: 0;
        }

        .empty-panel {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px dashed rgba(148, 163, 184, 0.18);
        }

        @media (max-width: 960px) {
          .coach-hero,
          .coach-grid,
          .coach-grid-tight {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .coach-shell {
            padding: 14px;
            border-radius: 18px;
          }

          .hero-copy,
          .hero-card,
          .coach-panel,
          .reason-card,
          .heat-card,
          .target-card {
            border-radius: 18px;
            padding: 14px;
          }

          .hero-copy h2 {
            max-width: none;
          }

          .hero-meta,
          .scan-nav {
            gap: 6px;
          }

          .hero-meta span,
          .scan-chip {
            width: 100%;
            justify-content: center;
          }

          .section-head,
          .panel-head,
          .reason-head,
          .heat-head,
          .topic-top,
          .target-head,
          .list-top,
          .share-top,
          .signal-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .reason-head span,
          .panel-pill,
          .hero-subtle,
          .target-badge,
          .target-meta span,
          .list-top span,
          .heat-head span,
          .topic-top span {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
