"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Sparkles, Target } from "lucide-react";

import { useThemeMode } from "@/hooks/useTheme";
import { TrainingInsights } from "@/components/training/TrainingInsights";
import {
  PlayNavigation,
  PlayModeLibrary,
  PlayPulse,
  PlayMissionShortcut,
} from "@/components/training/PlayHub";
import "./play.css";
import "./play-hub.css";

import { useTrainingCapabilities } from "./hooks/useTrainingCapabilities";
import { useTrainingDashboard } from "./hooks/useTrainingDashboard";
import { useTrainingSetup } from "./hooks/useTrainingSetup";
import { TrainingSetupDialog } from "./components/TrainingSetupDialog";

export default function PlayPage() {
  const { theme } = useThemeMode();

  const contentRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState("Play");
  const [exam, setExam] = useState("ssc-cgl");

  const { capabilities, error: capabilitiesError } = useTrainingCapabilities();
  const { dashboard, loading, error: dashboardError, setDashboard, setLoading, setError: setDashboardError } = useTrainingDashboard(exam);
  const {
    selected, setSelected,
    subject, setSubject,
    topic, setTopic,
    count, setCount,
    tier, setTier,
    minutes, setMinutes,
    busy, error: setupError,
    choose, start
  } = useTrainingSetup(exam);

  const error = capabilitiesError || dashboardError || setupError;

  useEffect(() => {
    if (!selected) return;
    const dialog = document.getElementById("training-setup") as HTMLDialogElement | null;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const content = contentRef.current;
    const previousContentOverflow = content?.style.overflowY || "";
    
    if (content) content.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (content) content.style.overflowY = previousContentOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [selected]);

  function navigate(tab: string) {
    setTab(tab);
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div
      className={`training-page play-hub ${theme === "dark" ? "training-dark" : ""}`}
    >
      <header className="training-header" data-ui-chrome="header">
        <div className="training-header-top">
          <Link href="/play" className="training-brand">
            <span className="training-brand-icon">
              <Target size={18} strokeWidth={2.2} />
            </span>
            <span className="training-brand-name">Play</span>
            <span className="training-brand-caption">
              MEOW GURU / TRAINING STUDIO
            </span>
          </Link>
          <div className="training-exam-wrapper">
            <label className="training-exam">
              <span className="sr-only">Target exam</span>
              <select
                value={exam}
                onChange={(e) => {
                  setExam(e.target.value);
                  setDashboard(null);
                  setLoading(true);
                  setDashboardError("");
                  setSubject("");
                  setTopic("");
                }}
              >
                {(capabilities?.exams || [
                  { id: "ssc-cgl", label: "SSC CGL" },
                  { id: "ssc-chsl", label: "SSC CHSL" },
                  { id: "cat", label: "CAT" },
                ]).map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="training-exam-chevron"
                aria-hidden="true"
              />
            </label>
          </div>
        </div>
        <PlayNavigation mobile tab={tab} onChange={navigate} />
      </header>
      <div className="training-layout">
        <aside className="training-sidebar">
          <p className="training-kicker">YOUR TRAINING</p>
          <PlayNavigation tab={tab} onChange={navigate} />
          <div className="training-side-note">
            <Target size={24} />
            <strong>Train with intent.</strong>
            <p>Choose an objective. Measure the work. Come back stronger.</p>
          </div>
        </aside>
        <main
          ref={contentRef}
          className="training-main"
          aria-label="Training content"
        >
          <div className="training-heading">
            <div>
              <p className="training-kicker">
                {exam.replaceAll("-", " ").toUpperCase()} · YOUR NEXT SESSION
              </p>
              <h1>
                {tab === "Play"
                  ? "Choose your training."
                  : tab === "Train Me"
                    ? "Your daily mission."
                    : tab === "Mock"
                      ? "Train for the real paper."
                      : tab === "Review"
                        ? "Make it stick."
                        : "See what is improving."}
              </h1>
              <p>
                {tab === "Play"
                  ? "Build accuracy, speed and exam confidence."
                  : tab === "Train Me"
                    ? "A practical next step, shaped by your recent work."
                    : tab === "Mock"
                      ? "Previous papers and full mocks belong in the exam simulator."
                      : tab === "Review"
                        ? "Revisit mistakes and uncertain answers at the right time."
                        : "Evidence from your completed training sessions."}
              </p>
            </div>
            <span className="training-outline-label">
              <Sparkles size={14} aria-hidden="true" /> Your personal training
              space
            </span>
          </div>
          {error && !selected && (
            <div role="alert" className="training-error">
              {error}
              <button
                data-ui-button="secondary"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}
          {dashboard?.active.length ? (
            <div className="training-resume" role="status">
              <div className="training-resume-content">
                <span className="training-resume-indicator" aria-hidden="true">
                  <span className="training-resume-dot" />
                </span>
                <div>
                  <strong>Continue your session</strong>
                  <p>Progress saved · Clock still running</p>
                </div>
              </div>
              <Link
                data-ui-button="secondary"
                className="training-resume-btn"
                href={`/play/session/${dashboard.active[0].id}`}
              >
                Resume <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : null}
          {tab === "Train Me" && (
            <section className="training-mission" aria-label="Daily mission">
              <div className="training-mission-copy">
                <span className="training-kicker">
                  <Sparkles size={15} /> YOUR DAILY MISSION
                </span>
                <h2>A plan built around your next step.</h2>
                <p>
                  {dashboard?.topics[0]
                    ? `Start with ${dashboard.topics[0].topic}, then build pace and review what is due.`
                    : "Start with a balanced session. Your answers will shape the next recommendation."}
                </p>
                <button
                  data-ui-button="primary"
                  disabled={busy || loading || !dashboard}
                  onClick={() => start("mission")}
                >
                  {busy ? "Building mission…" : "Start today’s mission"}{" "}
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="training-readiness">
                <div className="play-orbit" aria-hidden="true">
                  <Target size={46} strokeWidth={1.3} />
                </div>
                <span>PRACTICE READINESS</span>
                <strong>
                  {dashboard?.readiness ?? "—"}
                  <small>/100</small>
                </strong>
                <p>
                  {loading
                    ? "Loading your evidence…"
                    : dashboard?.readiness == null
                      ? "Complete 30 answers to establish a baseline."
                      : `Practice estimate · ${dashboard.evidenceConfidence || "low"} evidence confidence`}
                </p>
                <div className="training-meter">
                  <i style={{ width: `${dashboard?.readiness || 0}%` }} />
                </div>
              </div>
            </section>
          )}
          {tab === "Play" && (
            <>
              <PlayMissionShortcut
                loading={loading}
                available={!!dashboard}
                onOpen={() => navigate("Train Me")}
              />
              <PlayModeLibrary onChoose={(mode) => choose(mode, !!capabilities)} />
              <PlayPulse
                dashboard={dashboard}
                loading={loading}
                onChange={navigate}
              />
            </>
          )}
          {tab !== "Play" && (
            <TrainingInsights
              tab={tab}
              dashboard={dashboard}
              loading={loading}
              exam={exam}
              choose={(mode) => choose(mode, !!capabilities)}
            />
          )}
        </main>
      </div>

      <TrainingSetupDialog
        selected={selected}
        setSelected={setSelected}
        exam={exam}
        theme={theme}
        dashboard={dashboard}
        capabilities={capabilities}
        loading={loading}
        busy={busy}
        error={setupError}
        subject={subject}
        setSubject={setSubject}
        topic={topic}
        setTopic={setTopic}
        count={count}
        setCount={setCount}
        tier={tier}
        setTier={setTier}
        minutes={minutes}
        setMinutes={setMinutes}
        start={start}
      />
    </div>
  );
}
