'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesColumnIncreasing, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Layers, LockKeyhole, Minus, RotateCcw, Target, X } from 'lucide-react';
import type { MockAttempt, MockResultSection } from './api';
import styles from './ResultReport.module.css';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormat.format(value);
const sectionAccuracy = (section: MockResultSection) => {
  const attempted = (section.correct ?? 0) + (section.incorrect ?? 0);
  return section.accuracy ?? (attempted ? (section.correct ?? 0) / attempted * 100 : 0);
};
const pageSize = 4;

function SectionResults({ sections, onReview }: { sections: MockResultSection[]; onReview?: (sectionKey: string) => void }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(sections.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pages - 1));

  return <section id="section-results" className={styles.sectionBreakdown} aria-labelledby="section-results-title">
    <div className={styles.sectionHeading}>
      <div><span className={styles.eyebrow}>BY SUBJECT</span><h2 id="section-results-title">Section results</h2></div>
      <span className={styles.sectionCount}>{sections.length} sections</span>
    </div>
    <div className={styles.sectionLegend} aria-hidden="true">
      <span className={styles.correct}>Correct</span><span className={styles.incorrect}>Wrong</span><span className={styles.skipped}>Skipped</span>
    </div>
    <div className={styles.sectionRows}>
      {sections.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((section, index) => {
        const correct = section.correct ?? 0;
        const incorrect = section.incorrect ?? 0;
        const skipped = section.skipped ?? 0;
        const total = Math.max(section.total ?? 0, correct + incorrect + skipped, 1);
        const label = section.label || section.key || `Section ${currentPage * pageSize + index + 1}`;
        return <article className={styles.sectionRow} key={section.key ?? `${currentPage}-${index}`}>
          <div className={styles.sectionDetail}>
            <div className={styles.rowHeading}>
              <div className={styles.subjectHeading}><span className={styles.sectionOrdinal} aria-hidden="true">{String(currentPage * pageSize + index + 1).padStart(2, '0')}</span><h3>{label}</h3></div>
              <span className={styles.sectionScore}><strong>{formatNumber(section.score ?? 0)}</strong><span> / {formatNumber(section.maxScore ?? 0)}</span></span>
            </div>
            <div className={styles.rowDetails}>
              <div className={styles.sectionCounts}>
                <span className={styles.correct} aria-label={`${correct} correct`}><Check size={13} aria-hidden="true" />{correct}</span>
                <span className={styles.incorrect} aria-label={`${incorrect} wrong`}><X size={13} aria-hidden="true" />{incorrect}</span>
                <span className={styles.skipped} aria-label={`${skipped} skipped`}><Minus size={13} aria-hidden="true" />{skipped}</span>
              </div>
              <span>{percentFormat.format(sectionAccuracy(section))}% accuracy</span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <span className={styles.barCorrect} style={{ width: `${correct / total * 100}%` }} />
              <span className={styles.barIncorrect} style={{ width: `${incorrect / total * 100}%` }} />
              <span className={styles.barSkipped} style={{ width: `${skipped / total * 100}%` }} />
            </div>
          </div>
          {onReview && section.key && <button type="button" data-ui-button="icon" className={styles.sectionReview} aria-label={`Review ${label}`} title={`Review ${label}`} onClick={() => onReview(section.key!)}><ChevronRight size={18} aria-hidden="true" /></button>}
        </article>;
      })}
      {sections.length === 0 && <p className={styles.emptyState}>Section details are unavailable for this attempt.</p>}
    </div>
    {pages > 1 && <nav className={styles.pagination} aria-label="Section pages">
      <span aria-live="polite">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sections.length)} of {sections.length} sections</span>
      <div><button type="button" data-ui-button="icon" aria-label="Previous sections" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" data-ui-button="icon" aria-label="Next sections" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div>
    </nav>}
  </section>;
}

function FocusTopics({ areas }: { areas: string[] }) {
  const [selected, setSelected] = useState(areas[0]);
  return <div className={styles.focusTopics}>
    <label htmlFor="result-focus-topic">Focus on</label>
    <select id="result-focus-topic" value={selected} onChange={event => setSelected(event.target.value)}>
      {areas.map(area => <option key={area} value={area}>{area.replace(/-/g, ' ')}</option>)}
    </select>
    <a href={`/english/${selected}`}>Practice<ArrowRight size={14} aria-hidden="true" /></a>
  </div>;
}

interface ResultReportViewProps {
  data: MockAttempt;
  onReview: (sectionKey?: string) => void;
  onRetake: () => void;
  onBack: () => void;
  retakePending?: boolean;
  actionError?: string | null;
}

export default function ResultReportView({ data, onReview, onRetake, onBack, retakePending = false, actionError }: ResultReportViewProps) {
  const result = data.result;
  const score = result?.totalScore ?? data.totalScore ?? 0;
  const maxScore = result?.maxScore ?? data.maxScore ?? 0;
  const percentage = result?.percentage ?? (maxScore > 0 ? score / maxScore * 100 : 0);
  const sections = result?.sections ?? data.sections ?? [];
  const totals = sections.reduce<{ correct: number; incorrect: number; skipped: number }>((counts, section) => ({
    correct: counts.correct + (section.correct ?? 0), incorrect: counts.incorrect + (section.incorrect ?? 0), skipped: counts.skipped + (section.skipped ?? 0),
  }), { correct: 0, incorrect: 0, skipped: 0 });
  const attempted = totals.correct + totals.incorrect;
  const total = attempted + totals.skipped;
  const accuracy = attempted ? totals.correct / attempted * 100 : null;
  const coverage = total ? attempted / total * 100 : 0;
  const confidential = data.assessmentMode === 'confidential';
  const focusSection = sections.filter(section => (section.incorrect ?? 0) > 0).reduce<MockResultSection | undefined>((lowest, section) => !lowest || sectionAccuracy(section) < sectionAccuracy(lowest) ? section : lowest, undefined)
    ?? sections.find(section => (section.skipped ?? 0) > 0);
  const focusLabel = focusSection?.label || focusSection?.key || 'this paper';

  return <main className={styles.container}>
    <div className={styles.contentWrap}>
      <header className={styles.header}>
        <button type="button" data-ui-button="icon" className={styles.backButton} aria-label="Back to tests" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button>
        <div><p className={styles.examLabel}>{data.paper?.examName || 'Mock test'}</p><h1>Test result</h1></div>
        <span className={styles.completeBadge}><CircleCheck size={15} aria-hidden="true" />Submitted</span>
      </header>

      <nav className={styles.jumpNav} aria-label="Result sections">
        <Link href="#result-summary"><ChartNoAxesColumnIncreasing size={16} aria-hidden="true" />Overview</Link>
        <Link href="#section-results"><Layers size={16} aria-hidden="true" />Section results</Link>
      </nav>

      <div id="result-summary" className={styles.summaryGrid}>
        <section className={styles.scoreCard} aria-label="Score summary">
          <div className={styles.scoreSummary}>
            <span className={styles.eyebrow}>TOTAL SCORE</span>
            <div className={styles.scoreNumber}>{formatNumber(score)}<span>/ {formatNumber(maxScore)}</span></div>
            <p>{score < 0 ? 'Includes negative marking' : 'Your final score'}</p>
          </div>
          <div className={styles.scoreRing} role="img" aria-label={`Score percentage: ${percentFormat.format(percentage)}%`} style={{ '--score-progress': `${Math.min(100, Math.max(0, percentage))}%` } as CSSProperties}>
            <div><strong>{percentFormat.format(percentage)}<small>%</small></strong><span>of total marks</span></div>
          </div>
          <div className={styles.scoreFootnote}>
            <span><Check size={14} aria-hidden="true" />Assessment complete</span>
            {result?.percentile != null && <span className={styles.percentile}><ChartNoAxesColumnIncreasing size={14} aria-hidden="true" />{formatNumber(result.percentile)} percentile</span>}
          </div>
        </section>

        <section className={styles.performanceCard} aria-labelledby="performance-title">
          <div className={styles.sectionHeading}><h2 id="performance-title">Performance overview</h2><Target size={19} aria-hidden="true" /></div>
          <div className={styles.performanceMetrics}>
            <div><span>Accuracy</span><strong>{accuracy == null ? '—' : `${percentFormat.format(accuracy)}%`}</strong><small>of attempted questions</small></div>
            <div><span>Attempted</span><strong>{attempted}<small> / {total}</small></strong><small>questions answered</small></div>
          </div>
          <div className={styles.coverageTrack} aria-label={`${attempted} of ${total} questions attempted`}><span style={{ width: `${coverage}%` }} /></div>
          <div className={styles.stats} aria-label="Answer summary">
            <div><span className={styles.correct}><Check size={13} aria-hidden="true" />Correct</span><strong>{totals.correct}</strong></div>
            <div><span className={styles.incorrect}><X size={13} aria-hidden="true" />Wrong</span><strong>{totals.incorrect}</strong></div>
            <div><span className={styles.skipped}><Minus size={13} aria-hidden="true" />Skipped</span><strong>{totals.skipped}</strong></div>
          </div>
        </section>
      </div>

      <div className={styles.analysisGrid}>
        <SectionResults sections={sections} onReview={confidential ? undefined : onReview} />
        <aside className={styles.nextSteps} aria-labelledby="next-steps-title">
          <div className={styles.nextStepIcon}>{confidential ? <LockKeyhole size={23} aria-hidden="true" /> : <BookOpen size={23} aria-hidden="true" />}</div>
          <span className={styles.eyebrow}>{confidential ? 'ASSESSMENT POLICY' : 'KEEP IMPROVING'}</span>
          <h2 id="next-steps-title">{confidential ? 'Your result is saved' : 'Your next step'}</h2>
          {confidential ? <p className={styles.confidentialNote}>Confidential · Review and retakes unavailable.</p> : <>
            <h3>{focusSection ? `Revisit ${focusLabel}` : attempted > 0 && totals.correct === total ? 'Keep the momentum' : 'Review your answers'}</h3>
            <p>{focusSection ? `${focusSection.incorrect ?? 0} wrong · ${focusSection.skipped ?? 0} skipped. Work through the solutions before your next attempt.` : 'Check the explanations, then try the paper again with a fresh timer.'}</p>
            {focusSection?.key && <button type="button" data-ui-button="state" className={styles.textAction} onClick={() => onReview(focusSection.key)}>Review this section<ArrowUpRight size={16} aria-hidden="true" /></button>}
            {!!data.weakAreas?.length && <FocusTopics areas={data.weakAreas} />}
            <div className={styles.savedNote}><RotateCcw size={16} aria-hidden="true" /><span>A retake keeps this result saved.</span></div>
          </>}
        </aside>
      </div>
      <footer className={styles.actionDock} role="region" aria-label="Result actions">
        {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
        <div className={styles.dockInner}>
          <div className={styles.dockCaption}><BookOpen size={21} aria-hidden="true" /><div><strong>{confidential ? 'Assessment complete' : 'Turn this attempt into progress'}</strong><span>{confidential ? 'Your score and section results are saved.' : 'Review the solutions or start a fresh attempt.'}</span></div></div>
          <div className={styles.actions}>
            {!confidential && <button type="button" data-ui-button="primary" className={styles.btnPrimary} onClick={() => onReview()}>Review answers<ArrowRight size={17} aria-hidden="true" /></button>}
            {!confidential && <button type="button" data-ui-button="secondary" className={styles.btnOutline} onClick={onRetake} disabled={retakePending}><RotateCcw size={16} aria-hidden="true" />{retakePending ? 'Preparing…' : 'Retake'}</button>}
            <button type="button" data-ui-button="secondary" className={styles.btnOutline} onClick={onBack}><ClipboardList size={16} aria-hidden="true" />All tests</button>
          </div>
        </div>
      </footer>
    </div>
  </main>;
}
