"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  Suspense,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles, Target } from "lucide-react";

import { useThemeMode } from "@/hooks/useTheme";
import { TrainingSelectDropdown } from "@/components/training/TrainingSelectDropdown";
const TrainingInsights = dynamic(
  () =>
    import("@/components/training/TrainingInsights").then(
      (module) => module.TrainingInsights,
    ),
  { loading: () => <p role="status">Loading training insights…</p> },
);
import {
  PlayNavigation,
  PlayPulse,
  PlayMissionShortcut,
} from "@/components/training/PlayHub";
import { playTab, playHref } from "./play-navigation";

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

const PlayExamContext = createContext("ssc-cgl");

export function PlayModeButton({
  mode,
  className,
  label,
  children,
}: {
  mode: string;
  className: string;
  label: string;
  children: ReactNode;
}) {
  const exam = useContext(PlayExamContext);
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      data-ui-button="state"
      aria-label={label}
      onClick={() =>
        router.push(`/play/setup/${mode}?exam=${encodeURIComponent(exam)}`)
      }
    >
      {children}
    </button>
  );
}

export default function PlayClient({
  brand,
  sideNote,
  headings,
  modeLibrary,
}: {
  brand: ReactNode;
  sideNote: ReactNode;
  headings: Record<string, ReactNode>;
  modeLibrary: ReactNode;
}) {
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
  const {
    dashboard,
    loading,
    error: dashboardError,
    setDashboard,
    setLoading,
    setError: setDashboardError,
  } = useTrainingDashboard(exam);
  const {
    busy,
    error: setupError,
    setError: setSetupError,
    start,
  } = useTrainingSetup(exam);

  const error = capabilitiesError || dashboardError || setupError;

  const handleChooseMode = useCallback(
    (mode: string) => {
      router.push(`/play/setup/${mode}?exam=${encodeURIComponent(exam)}`);
    },
    [exam, router],
  );

  function navigate(nextTab: string) {
    setTab(nextTab);
    router.push(playHref(rawParamsRef.current, nextTab, exam), {
      scroll: false,
    });
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <PlayExamContext.Provider value={exam}>
      <div
        className={`training-page play-hub ${theme === "dark" ? "training-dark" : ""}`}
      >
        <Suspense fallback={null}>
          <SearchParamsSync onChange={handleParamsChange} />
        </Suspense>
        <header className="training-header" data-ui-chrome="header">
          <div className="training-header-top">
            {brand}
            <div className="training-exam-wrapper">
              <TrainingSelectDropdown
                className="training-exam"
                label="Target exam"
                value={exam}
                placement="bottom"
                options={(
                  capabilities?.exams || [
                    { id: "ssc-cgl", label: "SSC CGL" },
                    { id: "ssc-chsl", label: "SSC CHSL" },
                    { id: "cat", label: "CAT" },
                  ]
                ).map((item) => ({ value: item.id, label: item.label }))}
                onChange={(nextExam) => {
                  setExam(nextExam);
                  router.push(playHref(rawParamsRef.current, tab, nextExam), {
                    scroll: false,
                  });
                  setDashboard(null);
                  setLoading(true);
                  setDashboardError("");
                  setSetupError("");
                }}
              />
            </div>
          </div>
          <PlayNavigation mobile tab={tab} onChange={navigate} />
        </header>
        <div className="training-layout">
          <aside className="training-sidebar">
            <p className="training-kicker">YOUR TRAINING</p>
            <PlayNavigation tab={tab} onChange={navigate} />
            {sideNote}
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
                {headings[tab]}
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
                  <span
                    className="training-resume-indicator"
                    aria-hidden="true"
                  >
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
                {modeLibrary}
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
    </PlayExamContext.Provider>
  );
}
