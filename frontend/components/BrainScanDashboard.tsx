// frontend/components/BrainScanDashboard.tsx
// QuizGuru - Brain Scan Dashboard
// Visualizes the student's Cognitive Failure Map

"use client";

import { useEffect } from "react";
import { useBrainScan, WeakConcept } from "@/hooks/useCognitiveMapper";

type DimensionMeta = {
  label: string;
  color: string;
  bg: string;
  desc: string;
  signal: string;
  emoji: string;
};

const DIMENSION_META: Record<string, DimensionMeta> = {
  CONCEPTUAL_GAP: {
    label: "Conceptual Gap",
    color: "#A32D2D",
    bg: "#FCEBEB",
    desc: "Rule or base concept is missing.",
    signal: "Review notes before more timed practice.",
    emoji: "📚",
  },
  APPLICATION_ERROR: {
    label: "Application Error",
    color: "#854F0B",
    bg: "#FAEEDA",
    desc: "Concept is known, but the method broke.",
    signal: "Slow down and compare each solution step.",
    emoji: "⚙️",
  },
  TRAP_CAUGHT: {
    label: "Trap Caught",
    color: "#185FA5",
    bg: "#E6F1FB",
    desc: "A distractor matched a common SSC trap.",
    signal: "Mark why the wrong option looked tempting.",
    emoji: "🪤",
  },
  SPEED_PANIC: {
    label: "Speed Panic",
    color: "#3B6D11",
    bg: "#EAF3DE",
    desc: "Pressure or answer switching caused the miss.",
    signal: "Use shorter timed sets with no answer changes.",
    emoji: "⏱️",
  },
  BLIND_SPOT: {
    label: "Blind Spot",
    color: "#534AB7",
    bg: "#EEEDFE",
    desc: "Skipped, guessed, or answered too quickly.",
    signal: "Force a written reason before choosing.",
    emoji: "👁️",
  },
};

const PRESCRIPTION: Record<string, string> = {
  CONCEPTUAL_GAP: "Study the concept first, then do 10 easy questions.",
  APPLICATION_ERROR: "Do 15 medium Qs with step-by-step solution after each.",
  TRAP_CAUGHT: "Trap-identification drill: 10 SSC-style misleading questions.",
  SPEED_PANIC: "Timed pressure drill: 10 questions, 20 seconds each.",
  BLIND_SPOT: "Forced-engagement drill: 5 questions, explain before answering.",
};

const EMPTY_DISTRIBUTION = {
  CONCEPTUAL_GAP: 0,
  APPLICATION_ERROR: 0,
  TRAP_CAUGHT: 0,
  SPEED_PANIC: 0,
  BLIND_SPOT: 0,
};

const FALLBACK_META: DimensionMeta = {
  label: "Unknown Pattern",
  color: "#475569",
  bg: "#F1F5F9",
  desc: "Pattern is still being classified.",
  signal: "Keep practicing for a clearer scan.",
  emoji: "•",
};

interface Props {
  userId: string;
}

function getDimensionMeta(dimension: string) {
  return DIMENSION_META[dimension] || FALLBACK_META;
}

function formatLastSeen(iso?: string) {
  if (!iso) return "No timestamp";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No timestamp";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDataDepth(totalFailures: number) {
  if (totalFailures >= 12) return { label: "Stable", detail: "Enough misses for a dependable pattern." };
  if (totalFailures >= 5) return { label: "Developing", detail: "Useful trend, still improving with more attempts." };
  return { label: "Early", detail: "Based on a small current-attempt sample." };
}

function getSeverity(totalWrong: number) {
  if (totalWrong >= 5) return { label: "High", color: "#B42318", bg: "#FEF3F2" };
  if (totalWrong >= 3) return { label: "Medium", color: "#B54708", bg: "#FFFAEB" };
  return { label: "Watch", color: "#3538CD", bg: "#EEF4FF" };
}

function getLatestWeakConcept(concepts: WeakConcept[]) {
  return concepts.reduce<WeakConcept | null>((latest, concept) => {
    if (!latest) return concept;
    const latestTime = Date.parse(latest.lastSeen || "") || 0;
    const conceptTime = Date.parse(concept.lastSeen || "") || 0;
    return conceptTime > latestTime ? concept : latest;
  }, null);
}

export default function BrainScanDashboard({ userId }: Props) {
  const { data, loading, fetchBrainScan } = useBrainScan(userId);

  useEffect(() => {
    fetchBrainScan();
  }, [fetchBrainScan]);

  if (loading) {
    return (
      <div className="brain-scan-loading">
        <div className="scan-pulse">🧠</div>
        <p>Scanning your cognitive profile...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="brain-scan-empty">
        <p>Your Brain Scan will appear from your current quiz attempts.</p>
        <p className="sub">Wrong answers are tracked as you practice.</p>
      </div>
    );
  }

  const distribution = data.globalDistribution || EMPTY_DISTRIBUTION;
  const dimensionRows = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const total = dimensionRows.reduce((sum, [, count]) => sum + count, 0);
  const conceptsTracked = data.totalConceptsTracked ?? data.topWeakConcepts.length;
  const dominant = dimensionRows[0] || ["APPLICATION_ERROR", 0];
  const dominantMeta = getDimensionMeta(dominant[0]);
  const dominantPct = total > 0 ? Math.round((dominant[1] / total) * 100) : 0;
  const highRiskConcepts = data.topWeakConcepts.filter((concept) => concept.totalWrong >= 3).length;
  const latestWeakConcept = getLatestWeakConcept(data.topWeakConcepts);
  const dataDepth = getDataDepth(total);
  const sourceLabel =
    data.source === "recentQuizzes"
      ? "Current attempt status"
      : data.source === "failureMap"
        ? "AI-tagged failure map"
        : "Practice history";

  if (total === 0 && data.topWeakConcepts.length === 0) {
    return (
      <div className="brain-scan-empty">
        <p>No wrong answers tracked in your current attempts yet.</p>
        <p className="sub">Answer quiz questions and this panel will update automatically.</p>
      </div>
    );
  }

  return (
    <div className="brain-scan">
      <div className="bscan-header">
        <div>
          <h2>🧠 Brain Scan</h2>
          <p className="subtitle">
            {conceptsTracked} concepts tracked · {total} failures analyzed
          </p>
        </div>
        <span className="source-chip">{sourceLabel}</span>
      </div>

      <div className="scan-summary-grid">
        <div className="scan-metric">
          <span className="metric-label">Dominant pattern</span>
          <strong style={{ color: dominantMeta.color }}>{dominantMeta.label}</strong>
          <span className="metric-detail">{dominantPct}% of tracked misses</span>
        </div>
        <div className="scan-metric">
          <span className="metric-label">Data depth</span>
          <strong>{dataDepth.label}</strong>
          <span className="metric-detail">{dataDepth.detail}</span>
        </div>
        <div className="scan-metric">
          <span className="metric-label">High-risk concepts</span>
          <strong>{highRiskConcepts}</strong>
          <span className="metric-detail">3+ wrong answers in the map</span>
        </div>
        <div className="scan-metric">
          <span className="metric-label">Latest signal</span>
          <strong>{latestWeakConcept?.concept || "Current attempt"}</strong>
          <span className="metric-detail">{formatLastSeen(latestWeakConcept?.lastSeen || data.lastActiveDate)}</span>
        </div>
      </div>

      <div className="scan-insight">
        <div className="insight-main">
          <span className="insight-kicker">Priority pattern</span>
          <strong>{dominantMeta.emoji} {dominantMeta.label}</strong>
          <p>{dominantMeta.desc} {dominantMeta.signal}</p>
        </div>
        <div className="insight-action">
          <span>Next drill</span>
          <p>{PRESCRIPTION[dominant[0]] || "Keep practicing until the pattern is clearer."}</p>
        </div>
      </div>

      <div className="dimension-bar-section">
        <h3>Failure Pattern Overview</h3>
        <div className="dimension-bars">
          {dimensionRows.map(([dim, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const meta = getDimensionMeta(dim);
            return (
              <div className="dim-row" key={dim}>
                <div className="dim-label">
                  <span className="dim-emoji">{meta.emoji}</span>
                  <span className="dim-name">{meta.label}</span>
                  <span className="dim-desc">{meta.desc}</span>
                </div>
                <div className="dim-bar-track" aria-hidden="true">
                  <div className="dim-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                </div>
                <span className="dim-count">{count}</span>
                <span className="dim-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="weak-concepts-section">
        <h3>Top Weak Concepts</h3>
        {data.topWeakConcepts.length > 0 ? (
          <div className="concept-cards">
            {data.topWeakConcepts.map((concept) => (
              <ConceptCard key={concept.key} concept={concept} totalFailures={total} />
            ))}
          </div>
        ) : (
          <div className="weak-concepts-empty">No weak concepts found in current attempts.</div>
        )}
      </div>

      <style>{`
        .brain-scan { padding: 0; color: #1f2937; }
        .brain-scan-loading { text-align: center; padding: 3rem 1rem; color: #64748b; }
        .scan-pulse { font-size: 3rem; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
        .brain-scan-empty { text-align: center; padding: 2rem 1rem; color: #64748b; }
        .brain-scan-empty .sub { font-size: 0.85rem; margin-top: 0.5rem; }

        .bscan-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 1rem;
        }
        .bscan-header h2 { font-size: 1.35rem; font-weight: 700; margin: 0 0 4px; }
        .subtitle { color: #64748b; font-size: 0.85rem; margin: 0; }
        .source-chip {
          flex: 0 0 auto;
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(79, 70, 229, 0.1);
          color: #4338ca;
          font-size: 0.7rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .scan-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 1rem;
        }
        .scan-metric {
          min-width: 0;
          padding: 12px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.86);
        }
        .metric-label {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .scan-metric strong {
          display: block;
          min-width: 0;
          color: #0f172a;
          font-size: 1rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .metric-detail {
          display: block;
          margin-top: 5px;
          color: #64748b;
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .scan-insight {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 10px;
          margin-bottom: 1.25rem;
        }
        .insight-main,
        .insight-action {
          min-width: 0;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: #fff;
        }
        .insight-kicker,
        .insight-action span {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .insight-main strong {
          display: block;
          margin-bottom: 5px;
          font-size: 0.95rem;
        }
        .insight-main p,
        .insight-action p {
          margin: 0;
          color: #475569;
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .dimension-bar-section h3,
        .weak-concepts-section h3 {
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #64748b;
          margin: 0 0 0.75rem;
        }
        .dimension-bar-section { margin-bottom: 1.5rem; }
        .dimension-bars { display: flex; flex-direction: column; gap: 10px; }
        .dim-row {
          display: grid;
          grid-template-columns: minmax(145px, 1.1fr) minmax(80px, 1fr) 28px 40px;
          align-items: center;
          gap: 10px;
        }
        .dim-label { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .dim-emoji { font-size: 1rem; flex: 0 0 auto; }
        .dim-name { font-size: 0.84rem; font-weight: 700; white-space: nowrap; }
        .dim-desc { font-size: 0.75rem; color: #94a3b8; display: none; }
        .dim-bar-track { height: 8px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
        .dim-bar-fill { height: 100%; border-radius: 999px; transition: width 0.8s ease; }
        .dim-count,
        .dim-pct {
          font-size: 0.76rem;
          font-weight: 800;
          color: #475569;
          text-align: right;
        }

        .concept-cards { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .weak-concepts-empty {
          padding: 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #64748b;
          font-size: 0.85rem;
          background: #fff;
        }

        .concept-card {
          border-radius: 8px;
          padding: 1rem;
          background: #fff;
          border: 1px solid #e2e8f0;
        }
        .cc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 0.75rem;
        }
        .cc-title { min-width: 0; }
        .cc-topic {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
          margin: 0;
        }
        .cc-concept {
          font-size: 0.98rem;
          font-weight: 750;
          line-height: 1.25;
          margin: 3px 0 0;
          overflow-wrap: anywhere;
        }
        .cc-badge {
          flex: 0 0 auto;
          padding: 4px 8px;
          border-radius: 7px;
          font-size: 0.7rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .cc-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 0.7rem;
          color: #64748b;
          font-size: 0.78rem;
        }
        .cc-severity {
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 800;
        }
        .cc-share {
          margin-bottom: 0.8rem;
        }
        .cc-share-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .cc-share-track {
          height: 7px;
          border-radius: 999px;
          background: #f1f5f9;
          overflow: hidden;
        }
        .cc-share-fill {
          height: 100%;
          border-radius: 999px;
        }
        .cc-breakdown { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .cc-dim-pill { font-size: 0.7rem; padding: 3px 7px; border-radius: 999px; font-weight: 700; }
        .cc-prescription {
          font-size: 0.8rem;
          color: #475569;
          padding: 9px 10px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 3px solid #cbd5e1;
          line-height: 1.5;
        }

        @media (min-width: 720px) {
          .dim-desc { display: inline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }

        @media (max-width: 480px) {
          .bscan-header {
            flex-direction: column;
            gap: 8px;
          }

          .source-chip {
            align-self: flex-start;
          }

          .scan-summary-grid,
          .scan-insight {
            grid-template-columns: 1fr;
          }

          .dim-row {
            grid-template-columns: minmax(0, 1fr) 32px 40px;
            gap: 8px;
          }

          .dim-bar-track {
            grid-column: 1 / -1;
          }

          .cc-header {
            flex-direction: column;
            gap: 8px;
          }

          .cc-badge {
            align-self: flex-start;
          }

          .cc-meta-row {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

function ConceptCard({
  concept,
  totalFailures,
}: {
  concept: WeakConcept;
  totalFailures: number;
}) {
  const meta = getDimensionMeta(concept.dominantDimension);
  const prescription = PRESCRIPTION[concept.dominantDimension] || "Repeat this concept with solution review.";
  const severity = getSeverity(concept.totalWrong);
  const share = totalFailures > 0 ? Math.round((concept.totalWrong / totalFailures) * 100) : 0;

  return (
    <div className="concept-card">
      <div className="cc-header">
        <div className="cc-title">
          <p className="cc-topic">{concept.topic}</p>
          <p className="cc-concept">{concept.concept}</p>
        </div>
        <span className="cc-badge" style={{ background: meta.bg, color: meta.color }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      <div className="cc-meta-row">
        <span>{concept.totalWrong} wrong answers tracked</span>
        <span className="cc-severity" style={{ background: severity.bg, color: severity.color }}>
          {severity.label} priority
        </span>
      </div>

      <div className="cc-share">
        <div className="cc-share-top">
          <span>Share of current scan</span>
          <span>{share}%</span>
        </div>
        <div className="cc-share-track" aria-hidden="true">
          <div className="cc-share-fill" style={{ width: `${share}%`, background: meta.color }} />
        </div>
      </div>

      <div className="cc-breakdown">
        {Object.entries(concept.breakdown)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([dim, count]) => {
            const dimMeta = getDimensionMeta(dim);
            return (
              <span
                key={dim}
                className="cc-dim-pill"
                style={{ background: dimMeta.bg, color: dimMeta.color }}
              >
                {dimMeta.emoji} {count}
              </span>
            );
          })}
      </div>

      <div className="cc-prescription">
        <strong>Prescribed drill:</strong> {prescription}
      </div>
    </div>
  );
}
