import React, { useState, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Target, Flame, CheckCircle2, RotateCcw, ChevronLeft, Check, Sparkles, ChevronDown } from 'lucide-react';
import { QuizQuestionRecord, ConceptColour, SubjectConfig, ClassificationGroup, QuizMode } from '../types';
import { useThemeMode } from '@/hooks/useTheme';
import { MODE_LABELS } from '../utils';

export function SeriesConceptStart({
  subjectConfig,
  title,
  slug,
  routeBase,
  groups,
  category,
  categoryCounts,
  examFilter,
  examOptions,
  selected,
  conceptCount,
  questionCount,
  onCategoryChange,
  onExamChange,
  onToggleGroup,
  onStart,
}: {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  examFilter: string;
  examOptions: string[];
  selected: Set<string>;
  conceptCount: number;
  questionCount: number;
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
}) {
  const { theme } = useThemeMode();
  const [hasMounted, setHasMounted] = useState(false);
  const selectedCount = selected.size;
  const selectedQuestionLabel = selectedCount === 0 ? "all concepts" : `${selectedCount} concept${selectedCount === 1 ? "" : "s"}`;

  useLayoutEffect(() => {
    setHasMounted(true);
  }, []);

  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.push(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
    }
  };

  return (
    <div className="series-concept-screen" data-theme={hasMounted ? theme : "light"}>
      <header className="series-concept-nav">
        <button type="button" onClick={handleBack} className="series-concept-back" aria-label="Back to Series">
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong>{title}</strong>
        <span aria-hidden="true" />
      </header>

      <aside className="series-concept-aside" aria-label="Quiz overview">
        <span>{subjectConfig.subjectLabel}</span>
        <h1>{title}</h1>
        <p>Concept Practice</p>
        <dl>
          <div>
            <dt>Concepts</dt>
            <dd>{conceptCount}</dd>
          </div>
          <div>
            <dt>Questions</dt>
            <dd>{questionCount}</dd>
          </div>
        </dl>
      </aside>

      <main className="series-concept-content">
        <p className="series-concept-heading">Select Exam Target</p>
        <div className="series-dropdown-container mb-6">
          <div className="series-dropdown-row">
            <span className="series-concept-tile" style={{ background: "rgba(124, 108, 240, 0.15)", color: "var(--series-accent)" }}>
              <Target aria-hidden="true" className="w-4 h-4" />
            </span>
            <span className="series-dropdown-label">Exam Name</span>
            <div className="series-select-wrapper">
              <select
                value={examFilter || "all"}
                onChange={(e) => onExamChange(e.target.value === "all" ? "" : e.target.value)}
                className="series-dropdown-select"
              >
                {examOptions.map((ex) => (
                  <option key={ex} value={ex === "all" ? "all" : ex}>
                    {ex === "all" ? "All Exams" : ex}
                  </option>
                ))}
              </select>
              <ChevronDown className="series-select-chevron" />
            </div>
          </div>
        </div>

        <div className="series-concept-chips mb-4" aria-label="Concept category filters">
          <button
            type="button"
            className={category === "All" ? "active" : ""}
            onClick={() => onCategoryChange("All")}
          >
            <i className="chip-indigo" />All <span>{conceptCount}</span>
          </button>
          {subjectConfig.classificationCategories.filter((item) => categoryCounts[item.label] > 0).map((item) => (
            <button
              key={item.id}
              type="button"
              className={category === item.label ? "active" : ""}
              onClick={() => onCategoryChange(item.label)}
            >
              <i style={{ background: item.accent }} />{item.label} <span>{categoryCounts[item.label]}</span>
            </button>
          ))}
        </div>

        <p className="series-concept-heading">Concept Groups</p>
        <section className="series-concept-list" aria-label="Concept groups">
          {groups.map((group) => {
            const selectedInGroup = group.concepts.filter((concept) => selected.has(concept)).length;
            const groupIsSelected = selectedInGroup === group.concepts.length && group.concepts.length > 0;
            const groupIsPartial = selectedInGroup > 0 && !groupIsSelected;
            return (
              <button
                key={group.id}
                type="button"
                className="series-concept-row"
                onClick={() => onToggleGroup(group.concepts)}
                aria-pressed={groupIsSelected}
              >
                <span className={`series-concept-check${groupIsSelected || groupIsPartial ? " checked" : ""}`}>
                  {(groupIsSelected || groupIsPartial) && <Check aria-hidden="true" />}
                </span>
                <span
                  className="series-concept-tile"
                  style={{ background: group.bg, color: group.accent }}
                >
                  {group.icon}
                </span>
                <span className="series-concept-row-copy">
                  <strong>{group.label}</strong>
                  <small>
                    {group.concepts.length} concept{group.concepts.length === 1 ? "" : "s"}
                    {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                  </small>
                </span>
              </button>
            );
          })}
          {groups.length === 0 && (
            <p className="series-concept-empty">No concept groups found.</p>
          )}
        </section>
      </main>

      <footer className="series-concept-toolbar">
        <p><b>{questionCount}</b> questions ready - <span>{selectedQuestionLabel}</span></p>
        <button type="button" onClick={onStart} className="series-concept-start">
          <Sparkles aria-hidden="true" />
          Start Quiz
        </button>
      </footer>

      <style jsx>{`
        .series-concept-screen { --series-bg: #f2f2f7; --series-card: #fff; --series-separator: rgba(60, 60, 67, .18); --series-ink: #1c1c1e; --series-muted: #6e6a85; --series-subtle: rgba(60, 60, 67, .6); --series-field: rgba(118, 118, 128, .12); --series-nav: rgba(242, 242, 247, .9); --series-accent: #6c5ce0; min-height: 100dvh; background: var(--series-bg); color: var(--series-ink); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; padding-bottom: 132px; }
        .series-concept-screen[data-theme="dark"] { color-scheme: dark; --series-bg: #000; --series-card: #1c1c1e; --series-separator: rgba(84, 84, 88, .65); --series-ink: #fff; --series-muted: #98989f; --series-subtle: rgba(235, 235, 245, .6); --series-field: rgba(118, 118, 128, .24); --series-nav: rgba(0, 0, 0, .78); --series-accent: #7c6cf0; }
        .series-concept-nav { height: 44px; display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; border-bottom: 0.5px solid var(--series-separator); background: var(--series-nav); position: sticky; top: 0; z-index: 5; backdrop-filter: blur(20px); }
        .series-concept-nav strong { justify-self: center; font-size: 17px; font-weight: 600; }
        .series-concept-back { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: var(--series-accent); }
        .series-concept-back :global(svg) { width: 23px; height: 23px; stroke-width: 2.3; }
        .series-concept-content { width: min(100%, 430px); margin: 0 auto; padding: 12px 16px 24px; }
        .series-dropdown-container { overflow: hidden; border-radius: 12px; background: var(--series-card); border: 1px solid var(--series-separator); }
        .series-dropdown-row { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 16px; min-height: 56px; width: 100%; box-sizing: border-box; }
        .series-dropdown-label { font-size: 15px; font-weight: 600; color: var(--series-ink); white-space: nowrap; flex-shrink: 0; }
        .series-select-wrapper { position: relative; display: flex; align-items: center; margin-left: auto; min-width: 0; max-width: calc(100% - 140px); }
        .series-dropdown-select { appearance: none; -webkit-appearance: none; background: var(--series-field); color: var(--series-accent); font-size: 14px; font-weight: 600; padding: 8px 30px 8px 12px; border-radius: 10px; border: 1px solid var(--series-separator); outline: none; cursor: pointer; transition: all 0.15s ease; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 100%; box-sizing: border-box; }
        .series-dropdown-select option { background: var(--series-card); color: var(--series-ink); }
        .series-dropdown-select:focus { border-color: var(--series-accent); }
        .series-select-chevron { position: absolute; right: 10px; width: 14px; height: 14px; color: var(--series-accent); pointer-events: none; }
        .series-concept-chips { display: flex; gap: 10px; overflow-x: auto; padding: 12px 2px 16px; margin: 0 -2px; scrollbar-width: none; }
        .series-concept-chips::-webkit-scrollbar { display: none; }
        .series-concept-chips button { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; background: var(--series-field); padding: 8px 16px; color: var(--series-ink); font-size: 15px; font-weight: 700; white-space: nowrap; transition: all 0.15s ease; cursor: pointer; }
        .series-concept-chips button.active { background: var(--series-accent); color: #ffffff; box-shadow: 0 2px 8px rgba(108, 92, 224, 0.25); }
        .series-concept-chips i { width: 7px; height: 7px; border-radius: 50%; background: var(--series-accent); flex-shrink: 0; }
        .series-concept-chips button.active i { background: #ffffff !important; }
        .series-concept-chips span { color: var(--series-muted); font-size: 14px; font-weight: 600; margin-left: 1px; }
        .series-concept-chips button.active span { color: rgba(255, 255, 255, 0.85); }
        .series-concept-heading { margin: 0 0 6px 16px; color: var(--series-subtle); font-size: 13px; font-weight: 600; text-transform: uppercase; }
        .series-concept-list { overflow: hidden; border-radius: 12px; background: var(--series-card); }
        .series-concept-row { position: relative; width: 100%; min-height: 64px; display: flex; align-items: center; gap: 12px; border: 0; background: var(--series-card); padding: 11px 16px; text-align: left; color: var(--series-ink); }
        .series-concept-row:not(:last-child)::after { content: ""; position: absolute; right: 0; bottom: 0; left: 56px; height: 1px; background: var(--series-separator); opacity: 0.8; }
        .series-concept-check { width: 22px; height: 22px; flex: 0 0 auto; display: grid; place-items: center; border: 1.6px solid #c7c7cc; border-radius: 50%; color: #fff; }
        .series-concept-screen[data-theme="dark"] .series-concept-check { border-color: #545458; }
        .series-concept-check.checked { border-color: var(--series-accent); background: var(--series-accent); }
        .series-concept-check :global(svg) { width: 13px; height: 13px; stroke-width: 3; }
        .series-concept-tile { width: 30px; height: 30px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px; font-size: 10px; font-weight: 800; }
        .series-concept-row-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .series-concept-row-copy strong { font-size: 16px; font-weight: 600; }
        .series-concept-row-copy small { color: var(--series-muted); font-size: 13px; }
        .series-concept-empty { padding: 28px 16px; margin: 0; color: var(--series-muted); text-align: center; font-size: 14px; }
        .series-concept-toolbar { position: fixed; z-index: 10; right: 0; bottom: 0; left: 0; border-top: .5px solid var(--series-separator); background: var(--series-nav); padding: 10px max(16px, calc((100vw - 430px) / 2 + 16px)) calc(10px + env(safe-area-inset-bottom)); backdrop-filter: blur(20px); }
        .series-concept-toolbar p { margin: 0 0 8px; color: var(--series-muted); text-align: center; font-size: 13px; }
        .series-concept-toolbar b { color: var(--series-ink); font-weight: 700; }
        .series-concept-start { width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 12px; background: var(--series-accent); color: #fff; font-size: 17px; font-weight: 700; box-shadow: 0 2px 8px rgba(108, 92, 224, .22); }
        .series-concept-start:active { opacity: .72; }
        .series-concept-start :global(svg) { width: 16px; height: 16px; fill: currentColor; }
        .series-concept-aside { display: none; }
        @media (min-width: 1024px) {
          .series-concept-screen { display: grid; grid-template-columns: minmax(210px, 1fr) minmax(520px, 760px) minmax(260px, 1fr); grid-template-rows: 68px minmax(calc(100dvh - 68px), auto); min-height: 100dvh; padding: 0; }
          .series-concept-nav { grid-column: 1 / -1; height: 68px; grid-template-columns: minmax(210px, 1fr) minmax(520px, 760px) minmax(260px, 1fr); border-bottom: 1px solid var(--series-separator); padding: 0 38px; }
          .series-concept-nav strong { grid-column: 2; font-size: 18px; letter-spacing: 0; }
          .series-concept-back { position: absolute; left: 28px; width: 44px; height: 68px; }
          .series-concept-aside { grid-column: 1; grid-row: 2; display: flex; flex-direction: column; align-items: flex-end; padding: 64px 44px; border-right: 1px solid var(--series-separator); text-align: right; }
          .series-concept-aside > span { color: var(--series-accent); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          .series-concept-aside h1 { margin: 8px 0 2px; color: var(--series-ink); font-size: 28px; line-height: 1.12; letter-spacing: 0; }
          .series-concept-aside > p { margin: 0; color: var(--series-muted); font-size: 15px; }
          .series-concept-aside dl { display: grid; grid-template-columns: repeat(2, max-content); gap: 20px; margin: 52px 0 0; }
          .series-concept-aside dl div { display: flex; flex-direction: column-reverse; gap: 3px; }
          .series-concept-aside dt { color: var(--series-muted); font-size: 12px; }
          .series-concept-aside dd { margin: 0; color: var(--series-ink); font-size: 22px; font-weight: 700; }
          .series-concept-content { grid-column: 2; grid-row: 2; width: 100%; margin: 0; padding: 58px 44px 72px; }

          .series-concept-chips { padding: 18px 2px 22px; }
          .series-concept-heading { margin-left: 0; }
          .series-concept-list { border: 1px solid var(--series-separator); border-radius: 8px; }
          .series-concept-row { min-height: 76px; padding: 14px 18px; transition: background .15s ease; }
          .series-concept-row:hover { background: var(--series-field); }
          .series-concept-toolbar { position: sticky; grid-column: 3; grid-row: 2; align-self: start; width: auto; margin: 46px 38px; border: 1px solid var(--series-separator); border-radius: 8px; background: var(--series-card); padding: 20px; transform: none; backdrop-filter: none; }
          .series-concept-toolbar p { margin-bottom: 16px; text-align: left; font-size: 14px; }
          .series-concept-start { min-height: 48px; border-radius: 8px; font-size: 16px; }
        }
      `}</style>
    </div>
  );
}

export function SeriesFormulaStart({
  subjectConfig,
  title,
  slug,
  routeBase,
  mode,
  examFilter,
  examOptions,
  questionCount,
  onExamChange,
  groups,
  category,
  categoryCounts,
  search,
  selected,
  conceptCount,
  onCategoryChange,
  onSearchChange,
  onToggleGroup,
  onStart,
}: {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode: QuizMode;
  examFilter: string;
  examOptions: string[];
  questionCount: number;
  onExamChange: (exam: string) => void;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
  search: string;
  selected: Set<string>;
  conceptCount: number;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
}) {
  const { theme } = useThemeMode();
  const [hasMounted, setHasMounted] = useState(false);

  useLayoutEffect(() => {
    setHasMounted(true);
  }, []);

  const activeTheme = hasMounted ? theme : "light";

  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.push(routeBase ?? `/${subjectConfig.subjectId}/${slug}`);
    }
  };

  const selectedCount = selected.size;
  const selectedQuestionLabel = selectedCount === 0 ? "all concepts" : `${selectedCount} concept${selectedCount === 1 ? "" : "s"}`;

  return (
    <div className="series-concept-screen" data-theme={activeTheme}>
      <header className="series-concept-nav">
        <button type="button" onClick={handleBack} className="series-concept-back" aria-label={`Back to ${title}`}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong>{title} - {MODE_LABELS[mode]}</strong>
        <span aria-hidden="true" />
      </header>

      <aside className="series-concept-aside" aria-label="Quiz overview">
        <span>{subjectConfig.subjectLabel}</span>
        <h1>{title}</h1>
        <p>{MODE_LABELS[mode]}</p>
        <dl>
          <div>
            <dt>Concepts</dt>
            <dd>{conceptCount}</dd>
          </div>
          <div>
            <dt>Questions</dt>
            <dd>{questionCount}</dd>
          </div>
        </dl>
      </aside>

      <main className="series-concept-content">
        <p className="series-concept-heading">Select Exam Target</p>
        <div className="series-dropdown-container mb-6">
          <div className="series-dropdown-row">
            <span className="series-concept-tile" style={{ background: "rgba(124, 108, 240, 0.15)", color: "var(--series-accent)" }}>
              <Target aria-hidden="true" className="w-4 h-4" />
            </span>
            <span className="series-dropdown-label">Exam Name</span>
            <div className="series-select-wrapper">
              <select
                value={examFilter || "all"}
                onChange={(e) => onExamChange(e.target.value === "all" ? "" : e.target.value)}
                className="series-dropdown-select"
              >
                {examOptions.map((ex) => (
                  <option key={ex} value={ex === "all" ? "all" : ex}>
                    {ex === "all" ? "All Exams" : ex}
                  </option>
                ))}
              </select>
              <ChevronDown className="series-select-chevron" />
            </div>
          </div>
        </div>

        <div className="series-concept-chips mb-4" aria-label="Concept category filters">
          <button
            type="button"
            className={category === "All" ? "active" : ""}
            onClick={() => onCategoryChange("All")}
          >
            <i className="chip-indigo" />All <span>{conceptCount}</span>
          </button>
          {subjectConfig.classificationCategories.filter((item) => categoryCounts[item.label] > 0).map((item) => (
            <button
              key={item.id}
              type="button"
              className={category === item.label ? "active" : ""}
              onClick={() => onCategoryChange(item.label)}
            >
              <i style={{ background: item.accent }} />{item.label} <span>{categoryCounts[item.label]}</span>
            </button>
          ))}
        </div>

        <p className="series-concept-heading">Concept Groups</p>
        <section className="series-concept-list mb-6" aria-label="Concept groups">
          {groups.map((group) => {
            const selectedInGroup = group.concepts.filter((concept) => selected.has(concept)).length;
            const groupIsSelected = selectedInGroup === group.concepts.length && group.concepts.length > 0;
            const groupIsPartial = selectedInGroup > 0 && !groupIsSelected;
            return (
              <button
                key={group.id}
                type="button"
                className="series-concept-row"
                onClick={() => onToggleGroup(group.concepts)}
                aria-pressed={groupIsSelected}
              >
                <span className={`series-concept-check${groupIsSelected || groupIsPartial ? " checked" : ""}`}>
                  {(groupIsSelected || groupIsPartial) && <Check aria-hidden="true" />}
                </span>
                <span
                  className="series-concept-tile"
                  style={{ background: group.bg, color: group.accent }}
                >
                  {group.icon}
                </span>
                <span className="series-concept-row-copy">
                  <strong>{group.label}</strong>
                  <small>
                    {group.concepts.length} concept{group.concepts.length === 1 ? "" : "s"}
                    {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                  </small>
                </span>
              </button>
            );
          })}
          {groups.length === 0 && (
            <p className="series-concept-empty">No concept groups match &quot;{search}&quot;.</p>
          )}
        </section>
      </main>

      <footer className="series-concept-toolbar">
        <p>
          <b>{questionCount}</b> questions ready - <span>{selectedQuestionLabel}</span>
        </p>
        <button type="button" onClick={onStart} className="series-concept-start">
          <Sparkles aria-hidden="true" />
          Start Quiz
        </button>
      </footer>

      <style jsx>{`
        .series-concept-screen {
          --series-bg: #f2f2f7;
          --series-card: #ffffff;
          --series-separator: rgba(60, 60, 67, 0.18);
          --series-ink: #1c1c1e;
          --series-muted: #6e6a85;
          --series-subtle: rgba(60, 60, 67, 0.6);
          --series-field: rgba(118, 118, 128, 0.12);
          --series-nav: rgba(242, 242, 247, 0.9);
          --series-accent: #6c5ce0;
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: var(--series-bg);
          color: var(--series-ink);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
          padding-bottom: 0;
        }
        .series-concept-screen[data-theme="dark"] {
          color-scheme: dark;
          --series-bg: #000000;
          --series-card: #1c1c1e;
          --series-separator: rgba(84, 84, 88, 0.65);
          --series-ink: #ffffff;
          --series-muted: #98989f;
          --series-subtle: rgba(235, 235, 245, 0.6);
          --series-field: rgba(118, 118, 128, 0.24);
          --series-nav: rgba(0, 0, 0, 0.78);
          --series-accent: #7c6cf0;
        }
        .series-concept-nav {
          height: 44px;
          display: grid;
          grid-template-columns: 44px 1fr auto;
          align-items: center;
          border-bottom: 0.5px solid var(--series-separator);
          background: var(--series-nav);
          position: sticky;
          top: 0;
          z-index: 5;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .series-concept-nav strong {
          justify-self: center;
          font-size: 17px;
          font-weight: 600;
        }
        .series-concept-back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          color: var(--series-accent);
        }
        .series-concept-back :global(svg) {
          width: 23px;
          height: 23px;
          stroke-width: 2.3;
        }
        .series-concept-content {
          width: min(100%, 430px);
          margin: 0 auto;
          padding: 10px 16px 12px;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .series-concept-pill {
          background: var(--series-field);
          color: var(--series-accent);
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .series-concept-heading {
          margin: 0 0 6px 16px;
          color: var(--series-subtle);
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .series-concept-list {
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
          border-radius: 12px;
          background: var(--series-card);
        }
        .series-concept-row {
          position: relative;
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 0;
          background: var(--series-card);
          padding: 8px 14px;
          text-align: left;
          color: var(--series-ink);
        }
        .series-concept-row:not(:last-child)::after {
          content: "";
          position: absolute;
          right: 0;
          bottom: 0;
          left: 56px;
          height: 1px;
          background: var(--series-separator);
          opacity: 0.8;
        }
        .series-concept-check {
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border: 1.6px solid #c7c7cc;
          border-radius: 50%;
          color: #fff;
        }
        .series-concept-screen[data-theme="dark"] .series-concept-check {
          border-color: #545458;
        }
        .series-concept-check.checked {
          border-color: var(--series-accent);
          background: var(--series-accent);
        }
        .series-concept-check :global(svg) {
          width: 13px;
          height: 13px;
          stroke-width: 3;
        }
        .series-concept-tile {
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 7px;
        }
        .series-concept-row-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .series-concept-row-copy strong {
          font-size: 16px;
          font-weight: 600;
        }
        .series-concept-row-copy small {
          color: var(--series-muted);
          font-size: 13px;
        }
        .series-concept-chips { display: flex; gap: 10px; overflow-x: auto; padding: 12px 2px 16px; margin: 0 -2px; scrollbar-width: none; }
        .series-concept-chips::-webkit-scrollbar { display: none; }
        .series-concept-chips button { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; background: var(--series-field); padding: 8px 16px; color: var(--series-ink); font-size: 15px; font-weight: 700; white-space: nowrap; transition: all 0.15s ease; cursor: pointer; }
        .series-concept-chips button.active { background: var(--series-accent); color: #ffffff; box-shadow: 0 2px 8px rgba(108, 92, 224, 0.25); }
        .series-concept-chips i { width: 7px; height: 7px; border-radius: 50%; background: var(--series-accent); flex-shrink: 0; }
        .series-concept-chips button.active i { background: #ffffff !important; }
        .series-concept-chips span { color: var(--series-muted); font-size: 14px; font-weight: 600; margin-left: 1px; }
        .series-concept-chips button.active span { color: rgba(255, 255, 255, 0.85); }
        .chip-indigo { background: #6c5ce0 !important; }
        .series-dropdown-container {
          overflow: hidden;
          border-radius: 12px;
          background: var(--series-card);
          border: 1px solid var(--series-separator);
        }
        .series-dropdown-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          min-height: 56px;
          width: 100%;
          box-sizing: border-box;
        }
        .series-dropdown-label {
          font-size: 15px;
          font-weight: 600;
          color: var(--series-ink);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .series-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          margin-left: auto;
          min-width: 0;
          max-width: calc(100% - 140px);
        }
        .series-dropdown-select {
          appearance: none;
          -webkit-appearance: none;
          background: var(--series-field);
          color: var(--series-accent);
          font-size: 14px;
          font-weight: 600;
          padding: 8px 30px 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--series-separator);
          outline: none;
          cursor: pointer;
          transition: all 0.15s ease;
          text-overflow: ellipsis;
          white-space: nowrap;
          overflow: hidden;
          max-width: 100%;
          box-sizing: border-box;
        }
        .series-dropdown-select option {
          background: var(--series-card);
          color: var(--series-ink);
        }
        .series-dropdown-select:focus {
          border-color: var(--series-accent);
        }
        .series-select-chevron {
          position: absolute;
          right: 10px;
          width: 14px;
          height: 14px;
          color: var(--series-accent);
          pointer-events: none;
        }
        .series-formula-card {
          overflow: hidden;
          border-radius: 12px;
          background: var(--series-card);
          padding: 16px;
        }
        .series-formula-card-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .series-concept-toolbar {
          position: relative;
          z-index: 10;
          flex: 0 0 auto;
          border-top: 0.5px solid var(--series-separator);
          background: var(--series-nav);
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .series-concept-toolbar p {
          margin: 0 0 8px;
          color: var(--series-muted);
          text-align: center;
          font-size: 13px;
        }
        .series-concept-toolbar b {
          color: var(--series-ink);
          font-weight: 700;
        }
        .series-concept-start {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-radius: 12px;
          background: var(--series-accent);
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(108, 92, 224, 0.22);
        }
        .series-concept-start:active {
          opacity: 0.72;
        }
        .series-concept-aside {
          display: none;
        }
        @media (min-width: 1024px) {
          .series-concept-screen {
            display: grid;
            grid-template-columns: minmax(210px, 1fr) minmax(520px, 760px) minmax(260px, 1fr);
            grid-template-rows: 68px minmax(calc(100dvh - 68px), auto);
            min-height: 100dvh;
            padding: 0;
          }
          .series-concept-nav {
            grid-column: 1 / -1;
            height: 68px;
            grid-template-columns: minmax(210px, 1fr) minmax(520px, 760px) minmax(260px, 1fr);
            border-bottom: 1px solid var(--series-separator);
            padding: 0 38px;
          }
          .series-concept-nav strong {
            grid-column: 2;
            font-size: 18px;
            letter-spacing: 0;
          }
          .series-concept-back {
            position: absolute;
            left: 28px;
            width: 44px;
            height: 68px;
          }
          .series-concept-aside {
            grid-column: 1;
            grid-row: 2;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            padding: 64px 44px;
            border-right: 1px solid var(--series-separator);
            text-align: right;
          }
          .series-concept-aside > span {
            color: var(--series-accent);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .series-concept-aside h1 {
            margin: 8px 0 2px;
            color: var(--series-ink);
            font-size: 28px;
            line-height: 1.12;
            letter-spacing: 0;
          }
          .series-concept-aside > p {
            margin: 0;
            color: var(--series-muted);
            font-size: 15px;
          }
          .series-concept-aside dl {
            display: grid;
            grid-template-columns: repeat(2, max-content);
            gap: 20px;
            margin: 52px 0 0;
          }
          .series-concept-aside dl div {
            display: flex;
            flex-direction: column-reverse;
            gap: 3px;
          }
          .series-concept-aside dt {
            color: var(--series-muted);
            font-size: 12px;
          }
          .series-concept-aside dd {
            margin: 0;
            color: var(--series-ink);
            font-size: 22px;
            font-weight: 700;
          }
          .series-concept-content {
            grid-column: 2;
            grid-row: 2;
            width: 100%;
            margin: 0;
            padding: 58px 44px 72px;
          }
          .series-concept-heading {
            margin-left: 0;
          }
          .series-concept-list {
            border: 1px solid var(--series-separator);
            border-radius: 8px;
          }
          .series-concept-row {
            min-height: 76px;
            padding: 14px 18px;
            transition: background 0.15s ease;
          }
          .series-concept-row:hover {
            background: var(--series-field);
          }
          .series-concept-toolbar {
            position: sticky;
            grid-column: 3;
            grid-row: 2;
            align-self: start;
            width: auto;
            margin: 46px 38px;
            border: 1px solid var(--series-separator);
            border-radius: 8px;
            background: var(--series-card);
            padding: 20px;
            transform: none;
            backdrop-filter: none;
          }
          .series-concept-toolbar p {
            margin-bottom: 16px;
            text-align: left;
            font-size: 14px;
          }
          .series-concept-start {
            min-height: 48px;
            border-radius: 8px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}

