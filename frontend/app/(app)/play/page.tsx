"use client";

import { useCallback, useRef, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Sparkles, Target } from "lucide-react";

import { useThemeMode } from "@/hooks/useTheme";
import { TrainingInsights } from "@/components/training/TrainingInsights";
import {
  PlayNavigation,
  PlayModeLibrary,
  PlayPulse,
  PlayMissionShortcut,
} from "@/components/training/PlayHub";
import { playTab, playHref } from "./play-navigation";
import "./play.css";
import "./play-hub.css";

import { useTrainingCapabilities } from "./hooks/useTrainingCapabilities";
import { useTrainingDashboard } from "./hooks/useTrainingDashboard";
import { useTrainingSetup } from "./hooks/useTrainingSetup";

function SearchParamsSync({
  onChange,
}: {
  onChange: (tab: string, exam: string, raw: string) => void;
}) {
  const searchParams = useSearchParams();
  const tab = playTab(searchParams.get("view"));
  const exam = searchParams.get("exam") || "ssc-cgl";
  const raw = searchParams.toString();

  useEffect(() => {
    onChange(tab, exam, raw);
  }, [tab, exam, raw, onChange]);

  return null;
}

function PlayContent() {
  const { theme } = useThemeMode();
  const router = useRouter();

  const contentRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState("Play");
  const [exam, setExam] = useState("ssc-cgl");
  const rawParamsRef = useRef("");

  const handleParamsChange = useCallback(
    (newTab: string, newExam: string, raw: string) => {
      setTab(newTab);
      setExam(newExam);
      rawParamsRef.current = raw;
    },
    [],
  );

  const { capabilities, error: capabilitiesError } = useTrainingCapabilities();
  const { dashboard, loading, error: dashboardError, setDashboard, setLoading, setError: setDashboardError } = useTrainingDashboard(exam);
  const {
    busy, error: setupError, setError: setSetupError,
    start
  } = useTrainingSetup(exam);

  const error = capabilitiesError || dashboardError || setupError;

  const handleChooseMode = useCallback((mode: string) => {
    router.push(`/play/setup/${mode}?exam=${encodeURIComponent(exam)}`);
  }, [exam, router]);

  function navigate(nextTab: string) {
    setTab(nextTab);
    router.push(playHref(rawParamsRef.current, nextTab, exam), { scroll: false });
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div
      className={`training-page play-hub ${theme === "dark" ? "training-dark" : ""}`}
    >
      <Suspense fallback={null}>
        <SearchParamsSync onChange={handleParamsChange} />
      </Suspense>
      <header className="training-header" data-ui-chrome="header">
        <div className="training-header-top">
          <Link href="/play" prefetch={false} className="training-brand">
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
                data-ui-field
                value={exam}
                onChange={(e) => {
                  const nextExam = e.target.value;
                  setExam(nextExam);
                  router.push(playHref(rawParamsRef.current, tab, nextExam), { scroll: false });
                  setDashboard(null);
                  setLoading(true);
                  setDashboardError("");
                  setSetupError("");
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
          {error && (
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
                prefetch={false}
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
              <PlayModeLibrary onChoose={handleChooseMode} />
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
              choose={handleChooseMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return <PlayContent />;
}
