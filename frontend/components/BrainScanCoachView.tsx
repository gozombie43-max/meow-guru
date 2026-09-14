// frontend/components/BrainScanCoachView.tsx
// QuizGuru - Brain Scan coaching view

"use client";
import { BrainScanStyles } from "@/features/brain-scan/components/BrainScanStyles";
import { buildCoachModel,formatCountLabel,formatLastSeen,getDimensionMeta,getSeverity,PRESCRIPTION } from "@/features/brain-scan/model/coach";

import { useBrainScan } from "@/hooks/useCognitiveMapper";
import { useEffect } from "react";

export default function BrainScanCoachView({ userId }: { userId: string }) {
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

  const { totalFailures, dominantMeta, dominantPct, weaknessSpread, dataDepth, sourceLabel, adaptiveNextDrill, mistakeCoach, subjectHeatmap, confidenceProfile, revisionPack, trapRadar, progressNarrative, latestWeakConcept, topCoachItem, headlineConcept, nextDrillLabel, nextDrillReason, nextDrillFocus, progressCopy, priorityTargets } = buildCoachModel(data);

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

      <BrainScanStyles />
    </div>
  );
}
