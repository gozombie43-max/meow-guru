"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  Flame,
  Info,
  Layers,
  LoaderCircle,
  Route,
  Shield,
  Sparkles,
  Target,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { TrainingFilterPicker } from "@/components/training/TrainingFilterPicker";
import { TrainingSelectDropdown } from "@/components/training/TrainingSelectDropdown";
import { TrainingLoading } from "@/components/training/TrainingLoading";


import { useThemeMode } from "@/hooks/useTheme";
import api from "@/shared/api/client";
import { isAxiosError } from "axios";
import {
  modes,
  type ModeId,
  type TrainingCapabilities,
  type TrainingDashboard,
} from "@/components/training/training-types";
import { TrainingInsights } from "@/components/training/TrainingInsights";
import {
  PlayNavigation,
  PlayModeLibrary,
  PlayPulse,
  PlayMissionShortcut,
} from "@/components/training/PlayHub";
import "./play.css";
import "./play-hub.css";

const modeIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  brain: Brain,
  target: Target,
  zap: Zap,
  timer: Timer,
  layers: Layers,
  route: Route,
  flame: Flame,
  shield: Shield,
};

const categoryIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  ai: Sparkles,
  speed: Zap,
  sectional: Layers,
  extreme: Flame,
};

export default function PlayPage() {
  const { theme } = useThemeMode();

  const router = useRouter();
  const contentRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState("Play"),
    [exam, setExam] = useState("ssc-cgl");
  const [dashboard, setDashboard] = useState<TrainingDashboard | null>(null),
    [capabilities, setCapabilities] = useState<TrainingCapabilities | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ModeId | null>(null),
    [subject, setSubject] = useState(""),
    [topic, setTopic] = useState(""),
    [count, setCount] = useState<number | "full">(20),
    [tier, setTier] = useState("1"),
    [minutes, setMinutes] = useState(10);
  const selectedMode = modes.find((m) => m.id === selected);
  const selectedPolicy = selected ? capabilities?.modes[selected] : undefined;
  const topicOptions = subject
    ? dashboard?.catalog
        .filter((item) => item.subject === subject)
        .map((item) => item.topic) || []
    : dashboard?.catalogTopics || [];

  useEffect(() => {
    let live = true;
    api
      .get<TrainingCapabilities>("/api/training/capabilities")
      .then(({ data }) => {
        if (live) setCapabilities(data);
      })
      .catch(() => {
        if (live) setError("Could not load training capabilities.");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    api
      .get<TrainingDashboard>("/api/training/dashboard", { params: { exam } })
      .then(({ data }) => {
        if (live) setDashboard(data);
      })
      .catch((e) => {
        if (live)
          setError(
            isAxiosError(e)
              ? e.response?.data?.error ||
                  "Could not load your training profile."
              : "Could not load training.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [exam]);
  useEffect(() => {
    if (!selected) return;
    const dialog = document.getElementById(
      "training-setup",
    ) as HTMLDialogElement | null;
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
  function choose(mode: ModeId) {
    if (!capabilities) {
      setError("Training setup is still loading. Please retry in a moment.");
      return;
    }
    setSelected(mode);
    setCount(mode === "section" ? 25 : 20);
    setError("");
  }
  async function start(override?: ModeId) {
    const mode = override || selected;
    if (!mode || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/training/sessions", {
        mode,
        exam,
        tier,
        subject: mode === "mission" ? undefined : subject || undefined,
        topic: mode === "mission" ? undefined : topic || undefined,
        count,
        minutes,
      });
      router.push(`/play/session/${data.id}`);
    } catch (e) {
      setError(
        isAxiosError(e)
          ? e.response?.data?.error ||
              "Could not start the session. Please retry."
          : "Could not start training.",
      );
      setBusy(false);
    }
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
                  setError("");
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
              <PlayModeLibrary onChoose={choose} />
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
              choose={(mode) => choose(mode)}
            />
          )}
        </main>
      </div>
      {selected && (
        <dialog
          id="training-setup"
          aria-labelledby="training-setup-title"
          aria-describedby="training-setup-description"
          className={`training-setup play-setup ${theme === "dark" ? "training-dark" : ""}`}
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setSelected(null);
          }}
        >
          {/* iOS Sheet Handle */}
          <div className="setup-sheet-handle" aria-hidden="true" />

          {/* Modal Header */}
          <div className="setup-sheet-header">
            <div className="setup-badge-group">
              <span className={`setup-cat-badge setup-cat--${selectedMode?.category?.toLowerCase() || "ai"}`}>
                {(() => {
                  const CatIcon = categoryIcons[selectedMode?.category?.toLowerCase() || "ai"] || Sparkles;
                  return <CatIcon size={12} strokeWidth={2.4} aria-hidden="true" />;
                })()}
                {selectedMode?.category || "Training"}
              </span>
              <span className="setup-kicker">SESSION BRIEF</span>
            </div>
            <button
              type="button"
              className="setup-close-btn"
              aria-label="Close setup"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>

          <div className="training-setup-scroll">
            {/* Mode Hero */}
            <div className="setup-hero">
              <div className={`setup-hero-icon-box setup-icon--${selectedMode?.category?.toLowerCase() || "ai"}`}>
                {(() => {
                  const ModeIcon = (selectedMode?.icon && modeIcons[selectedMode.icon as keyof typeof modeIcons]) || Sparkles;
                  return <ModeIcon size={24} strokeWidth={2.2} />;
                })()}
              </div>
              <div className="setup-hero-info">
                <h2 id="training-setup-title">
                  {selectedMode?.title || "Smart review"}
                </h2>
                <p id="training-setup-description">
                  {selectedMode?.detail ||
                    "Work through questions that are due for spaced review."}
                </p>
              </div>
            </div>

            {busy && (
              <TrainingLoading
                title="Preparing your questions"
                description="Choosing questions for your mode and selected topics. Your session will open when ready."
                skeleton={false}
              />
            )}

            {/* Form Fields Grid */}
            <fieldset
              className="setup-form-grid"
              disabled={busy || loading}
              aria-busy={busy || loading}
            >
              {selectedPolicy?.supportsTier && exam !== "cat" && (
                <TrainingSelectDropdown
                  label="Tier"
                  value={tier}
                  placeholder="Select tier"
                  options={[
                    { value: "1", label: "Tier I" },
                    { value: "2", label: "Tier II" },
                  ]}
                  disabled={busy || loading}
                  onChange={setTier}
                />
              )}

              {/* Subject — custom dropdown */}
              <TrainingSelectDropdown
                label="Subject"
                value={subject}
                placeholder={selectedPolicy?.requiresSubject ? "Choose a subject" : "All subjects"}
                options={[
                  { value: "", label: selectedPolicy?.requiresSubject ? "Choose a subject" : "All subjects" },
                  ...[...new Set(dashboard?.subjects || [])].map((s) => ({ value: s, label: s })),
                ]}
                disabled={busy || loading}
                onChange={(val) => {
                  if (val !== subject) {
                    setSubject(val);
                    setTopic("");
                  }
                }}
              />

              {/* Topic — iOS bottom-sheet modal */}
              <TrainingFilterPicker
                label="Topic"
                value={topic}
                options={topicOptions}
                emptyLabel="Balanced topic mix"
                onChange={setTopic}
              />

              {/* Questions — custom dropdown */}
              <TrainingSelectDropdown
                label="Questions"
                value={String(count)}
                placeholder="20 questions"
                placement="top"
                options={[
                  ...[10, 20, 25, 50].map((n) => ({ value: String(n), label: `${n} questions` })),
                  ...(selectedPolicy?.supportsFullSection
                    ? [{ value: "full", label: "Full configured section" }]
                    : []),
                ]}
                disabled={busy || loading}
                onChange={(val) => setCount(val === "full" ? "full" : Number(val))}
              />

              {/* Clock — custom dropdown */}
              {selectedPolicy?.clock === "fixed" && (
                <TrainingSelectDropdown
                  label="Clock"
                  value={String(minutes)}
                  placeholder="10 minutes"
                  placement="top"
                  options={(selectedPolicy.minuteOptions.length
                    ? selectedPolicy.minuteOptions
                    : [5, 10, 15]
                  ).map((n) => ({ value: String(n), label: `${n} minutes` }))}
                  disabled={busy || loading}
                  onChange={(val) => setMinutes(Number(val))}
                />
              )}
            </fieldset>


            {/* Note / Info Callout Card */}
            <div className="setup-info-card">
              <div className="setup-info-icon">
                <Info size={16} strokeWidth={2.4} aria-hidden="true" />
              </div>
              <div className="setup-info-text">
                <strong>
                  {selectedPolicy?.sectional
                    ? "Officially configured section marking is applied."
                    : "Practice scoring is applied by the server."}
                </strong>
                <p>
                  The clock continues if you leave. Bank availability may shorten the session.
                </p>
              </div>
            </div>

            {error && (
              <p className="training-error" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Sticky Modern Action Footer */}
          <footer className="setup-footer" data-ui-chrome="footer">
            <button
              className="setup-start-btn"
              disabled={
                busy ||
                loading ||
                (!!selectedPolicy?.requiresSubject && !subject)
              }
              onClick={() => start()}
            >
              <span>{busy ? "Building your session…" : "Begin training"}</span>
              {busy ? (
                <LoaderCircle className="setup-loading-spin" size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} strokeWidth={2.4} />
              )}
            </button>
          </footer>
        </dialog>
      )}
    </div>
  );
}
