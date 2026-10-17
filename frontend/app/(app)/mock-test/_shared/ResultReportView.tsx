'use client';

import { useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, RotateCcw, Minus, X } from 'lucide-react';
import type { MockAttempt, MockResultSection } from './api';
import styles from './ResultReport.module.css';

const formatNumber = (value: number) => Number(value.toFixed(1)).toString();
const pageSize = 4;

function SectionResults({ sections }: { sections: MockResultSection[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(sections.length / pageSize);

  return (
    <section className={styles.sectionBreakdown} aria-labelledby="section-results-title">
      <div className={styles.sectionHeading}>
        <h2 id="section-results-title">Section results</h2>
        {pages > 1 ? <div className={styles.pagination}>
          <button aria-label="Previous sections" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
          <span aria-live="polite">{page + 1} / {pages}</span>
          <button aria-label="Next sections" disabled={page === pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
        </div> : <span>{sections.length} sections</span>}
      </div>
      <div className={styles.sectionLegend} aria-hidden="true">
        <span className={styles.correct}>Correct</span>
        <span className={styles.incorrect}>Wrong</span>
        <span className={styles.skipped}>Skipped</span>
      </div>
      <div className={styles.sectionRows}>
        {sections.slice(page * pageSize, (page + 1) * pageSize).map((section, index) => {
          const correct = section.correct ?? 0;
          const incorrect = section.incorrect ?? 0;
          const skipped = section.skipped ?? 0;
          const total = Math.max(section.total ?? 0, correct + incorrect + skipped, 1);
          return <div className={styles.sectionRow} key={section.key ?? `${page}-${index}`}>
            <div className={styles.rowHeading}>
              <span className={styles.sectionName}>{section.label || section.key || `Section ${page * pageSize + index + 1}`}</span>
              <span className={styles.sectionScore}><strong>{formatNumber(section.score ?? 0)}</strong><span> / {formatNumber(section.maxScore ?? 0)}</span></span>
            </div>
            <div className={styles.rowDetails}>
              <div className={styles.sectionCounts}>
                <span className={styles.correct} aria-label={`${correct} correct`}><Check size={12} />{correct}</span>
                <span className={styles.incorrect} aria-label={`${incorrect} wrong`}><X size={12} />{incorrect}</span>
                <span className={styles.skipped} aria-label={`${skipped} skipped`}><Minus size={12} />{skipped}</span>
              </div>
              <span>{formatNumber(section.accuracy ?? 0)}% accuracy</span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <span className={styles.barCorrect} style={{ width: `${correct / total * 100}%` }} />
              <span className={styles.barIncorrect} style={{ width: `${incorrect / total * 100}%` }} />
              <span className={styles.barSkipped} style={{ width: `${skipped / total * 100}%` }} />
            </div>
          </div>;
        })}
        {sections.length === 0 && <p className={styles.emptyState}>Section details are unavailable for this attempt.</p>}
      </div>
    </section>
  );
}

function FocusTopics({ areas }: { areas: string[] }) {
  const [selected, setSelected] = useState(areas[0]);
  return <div className={styles.focusTopics}>
    <label htmlFor="result-focus-topic">Focus on</label>
    <select id="result-focus-topic" value={selected} onChange={event => setSelected(event.target.value)}>
      {areas.map(area => <option key={area} value={area}>{area.replace(/-/g, ' ')}</option>)}
    </select>
    <a href={`/english/${selected}`}>Practice<ArrowRight size={14} /></a>
  </div>;
}

interface ResultReportViewProps {
  data: MockAttempt;
  onReview: () => void;
  onRetake: () => void;
  onBack: () => void;
}

export default function ResultReportView({ data, onReview, onRetake, onBack }: ResultReportViewProps) {
  const result = data.result;
  const score = result?.totalScore ?? data.totalScore ?? 0;
  const maxScore = result?.maxScore ?? data.maxScore ?? 0;
  const percentage = result?.percentage ?? (maxScore > 0 ? score / maxScore * 100 : 0);
  const sections = result?.sections ?? data.sections ?? [];
  const totals = sections.reduce<{ correct: number; incorrect: number; skipped: number }>((counts, section) => ({
    correct: counts.correct + (section.correct ?? 0),
    incorrect: counts.incorrect + (section.incorrect ?? 0),
    skipped: counts.skipped + (section.skipped ?? 0),
  }), { correct: 0, incorrect: 0, skipped: 0 });
  const total = totals.correct + totals.incorrect + totals.skipped;
  const confidential = data.assessmentMode === 'confidential';

  return <main className={styles.container}>
    <div className={styles.contentWrap}>
      <header className={styles.header}>
        <button className={styles.backButton} aria-label="Back to tests" onClick={onBack}><ArrowLeft size={20} /></button>
        <div><h1>Test result</h1><p>{data.paper?.examName || 'Mock test'} · Completed</p></div>
        <span className={styles.completeBadge}><Check size={13} />Submitted</span>
      </header>

      <section className={styles.scoreCard} aria-label="Score summary">
        <div className={styles.scoreSummary}>
          <span className={styles.eyebrow}>TOTAL SCORE</span>
          <div className={styles.scoreNumber}>{formatNumber(score)}<span> / {formatNumber(maxScore)}</span></div>
          <p>{totals.correct + totals.incorrect} of {total} questions attempted</p>
          {result?.percentile != null && <span className={styles.percentile}>{formatNumber(result.percentile)} percentile</span>}
        </div>
        <div className={styles.scoreRing} style={{ '--score-progress': `${Math.min(100, Math.max(0, percentage))}%` } as CSSProperties}>
          <div><strong>{formatNumber(percentage)}<small>%</small></strong><span>Score</span></div>
        </div>
      </section>

      <div className={styles.stats} aria-label="Answer summary">
        <div><span className={styles.correct}><Check size={14} />Correct</span><strong>{totals.correct}</strong></div>
        <div><span className={styles.incorrect}><X size={14} />Wrong</span><strong>{totals.incorrect}</strong></div>
        <div><span className={styles.skipped}><Minus size={14} />Skipped</span><strong>{totals.skipped}</strong></div>
      </div>

      <SectionResults sections={sections} />
      {!!data.weakAreas?.length && <FocusTopics areas={data.weakAreas} />}
      {confidential && <p className={styles.confidentialNote}>Confidential · Review and retakes unavailable.</p>}
      <footer className={styles.actions}>
        {!confidential && <button data-ui-button="secondary" className={styles.btnPrimary} onClick={onReview}>Review answers<ArrowRight size={15} /></button>}
        {!confidential && <button data-ui-button="secondary" className={styles.btnOutline} onClick={onRetake}><RotateCcw size={14} />Retake</button>}
        <button data-ui-button="secondary" className={styles.btnOutline} onClick={onBack}>All tests</button>
      </footer>
    </div>
  </main>;
}
