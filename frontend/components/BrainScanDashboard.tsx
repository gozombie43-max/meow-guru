// frontend/components/BrainScanDashboard.tsx
// QuizGuru — Brain Scan Dashboard
// Visualizes the student's Cognitive Failure Map

"use client";

import { useEffect } from "react";
import { useBrainScan, WeakConcept } from "@/hooks/useCognitiveMapper";

const DIMENSION_META: Record<string, { label: string; color: string; bg: string; desc: string; emoji: string }> = {
  CONCEPTUAL_GAP: { label: "Conceptual Gap", color: "#A32D2D", bg: "#FCEBEB", desc: "Don't know the rule", emoji: "📚" },
  APPLICATION_ERROR: {
    label: "Application Error",
    color: "#854F0B",
    bg: "#FAEEDA",
    desc: "Know it, applied it wrong",
    emoji: "⚙️",
  },
  TRAP_CAUGHT: { label: "Trap Caught", color: "#185FA5", bg: "#E6F1FB", desc: "SSC distractor fooled you", emoji: "🪤" },
  SPEED_PANIC: { label: "Speed Panic", color: "#3B6D11", bg: "#EAF3DE", desc: "Changed correct → wrong", emoji: "⏱️" },
  BLIND_SPOT: { label: "Blind Spot", color: "#534AB7", bg: "#EEEDFE", desc: "Skipping / guessing", emoji: "👁️" },
};

const PRESCRIPTION: Record<string, string> = {
  CONCEPTUAL_GAP: "Study the concept first, then do 10 easy questions.",
  APPLICATION_ERROR: "Do 15 medium Qs with step-by-step solution after each.",
  TRAP_CAUGHT: "Trap-identification drill — 10 SSC-style misleading questions.",
  SPEED_PANIC: "Timed pressure drill — 10 Qs, 20 sec each, no extension.",
  BLIND_SPOT: "Forced-engagement drill — 5 Qs, must explain before answering.",
};

interface Props {
  userId: string;
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

  if (!data?.hasSufficientData) {
    return (
      <div className="brain-scan-empty">
        <p>Complete at least 3 quizzes to unlock your Brain Scan.</p>
        <p className="sub">Every wrong answer is being tracked — the map builds as you practice.</p>
      </div>
    );
  }

  const total = Object.values(data.globalDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="brain-scan">
      {/* Header */}
      <div className="bscan-header">
        <h2>🧠 Brain Scan</h2>
        <p className="subtitle">
          {data.totalConceptsTracked} concepts tracked · {total} failures analyzed
        </p>
      </div>

      {/* Global Dimension Distribution */}
      <div className="dimension-bar-section">
        <h3>Failure Pattern Overview</h3>
        <div className="dimension-bars">
          {Object.entries(data.globalDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([dim, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const meta = DIMENSION_META[dim];
              return (
                <div className="dim-row" key={dim}>
                  <div className="dim-label">
                    <span className="dim-emoji">{meta.emoji}</span>
                    <span className="dim-name">{meta.label}</span>
                    <span className="dim-desc">{meta.desc}</span>
                  </div>
                  <div className="dim-bar-track">
                    <div className="dim-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                  <span className="dim-pct">{pct}%</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Top Weak Concepts */}
      <div className="weak-concepts-section">
        <h3>Top Weak Concepts</h3>
        <div className="concept-cards">
          {data.topWeakConcepts.map((concept) => (
            <ConceptCard key={concept.key} concept={concept} />
          ))}
        </div>
      </div>

      <style>{`
        .brain-scan { padding: 0; }
        .brain-scan-loading { text-align: center; padding: 3rem; }
        .scan-pulse { font-size: 3rem; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
        .brain-scan-empty { text-align: center; padding: 2rem; color: #888; }
        .brain-scan-empty .sub { font-size: 0.85rem; margin-top: 0.5rem; }

        .bscan-header { margin-bottom: 1.5rem; }
        .bscan-header h2 { font-size: 1.3rem; font-weight: 600; margin: 0 0 4px; }
        .subtitle { color: #888; font-size: 0.85rem; margin: 0; }

        .dimension-bar-section h3,
        .weak-concepts-section h3 {
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #888;
          margin: 0 0 0.75rem;
        }
        .dimension-bar-section { margin-bottom: 2rem; }
        .dimension-bars { display: flex; flex-direction: column; gap: 10px; }
        .dim-row { display: grid; grid-template-columns: 200px 1fr 40px; align-items: center; gap: 12px; }
        .dim-label { display: flex; align-items: center; gap: 6px; }
        .dim-emoji { font-size: 1rem; }
        .dim-name { font-size: 0.85rem; font-weight: 500; }
        .dim-desc { font-size: 0.75rem; color: #999; display: none; }
        .dim-bar-track { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
        .dim-bar-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease; }
        .dim-pct { font-size: 0.8rem; font-weight: 600; color: #555; text-align: right; }

        .concept-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

        .concept-card { border-radius: 12px; padding: 1rem; background: #fff; border: 1px solid #eee; }
        .cc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .cc-topic { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #999; }
        .cc-concept { font-size: 0.95rem; font-weight: 600; margin: 2px 0 0; }
        .cc-badge { padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .cc-wrong { font-size: 0.8rem; color: #999; margin-bottom: 0.75rem; }
        .cc-breakdown { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .cc-dim-pill { font-size: 0.7rem; padding: 2px 7px; border-radius: 10px; font-weight: 500; }
        .cc-prescription { font-size: 0.78rem; color: #555; padding: 8px 10px; background: #f8f8f8; border-radius: 8px; border-left: 3px solid #ddd; line-height: 1.5; }

        @media (max-width: 480px) {
          .dim-row { grid-template-columns: 1fr 80px 30px; }
          .dim-desc { display: none; }
        }
      `}</style>
    </div>
  );
}

// ─── Concept Card ─────────────────────────────────────────────────────────────

function ConceptCard({ concept }: { concept: WeakConcept }) {
  const meta = DIMENSION_META[concept.dominantDimension];
  const prescription = PRESCRIPTION[concept.dominantDimension];

  return (
    <div className="concept-card">
      <div className="cc-header">
        <div>
          <p className="cc-topic">{concept.topic}</p>
          <p className="cc-concept">{concept.concept}</p>
        </div>
        <span className="cc-badge" style={{ background: meta.bg, color: meta.color }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      <p className="cc-wrong">{concept.totalWrong} wrong answers tracked</p>

      <div className="cc-breakdown">
        {Object.entries(concept.breakdown)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([dim, count]) => (
            <span
              key={dim}
              className="cc-dim-pill"
              style={{ background: DIMENSION_META[dim]?.bg, color: DIMENSION_META[dim]?.color }}
            >
              {DIMENSION_META[dim]?.emoji} {count}
            </span>
          ))}
      </div>

      <div className="cc-prescription">
        <strong>Prescribed drill:</strong> {prescription}
      </div>
    </div>
  );
}
