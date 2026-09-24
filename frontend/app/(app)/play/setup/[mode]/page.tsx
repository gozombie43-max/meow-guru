"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  Clock,
  FileText,
  Flame,
  Info,
  Layers,
  LoaderCircle,
  RotateCcw,
  Route,
  Shield,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/shared/api/client";
import { useThemeMode } from "@/hooks/useTheme";
import {
  modes,
} from "@/components/training/training-types";
import { TrainingSelectDropdown } from "@/components/training/TrainingSelectDropdown";
import { TrainingFilterPicker } from "@/components/training/TrainingFilterPicker";
import { TrainingLoading } from "@/components/training/TrainingLoading";
import { useTrainingCapabilities } from "../../hooks/useTrainingCapabilities";
import { useTrainingDashboard } from "../../hooks/useTrainingDashboard";
import "./setup.css";

const modeIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  brain: Brain,
  target: Target,
  zap: Zap,
  timer: Timer,
  layers: Layers,
  route: Route,
  flame: Flame,
  shield: Shield,
  "rotate-ccw": RotateCcw,
  sparkles: Sparkles,
};

const categoryIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  ai: Sparkles,
  speed: Zap,
  sectional: Layers,
  extreme: Flame,
};

const specialModes: Record<string, { id: string; title: string; category: string; description: string; detail: string; time: string; icon: string }> = {
  review: {
    id: "review",
    title: "Spaced Review",
    category: "AI",
    description: "Revisit past mistakes and flagged uncertain answers on a spaced repetition schedule.",
    detail: "Questions due for review are prioritized based on spaced repetition intervals.",
    time: "Due queue",
    icon: "rotate-ccw",
  },
  mission: {
    id: "mission",
    title: "Daily Mission",
    category: "AI",
    description: "A customized multi-block session crafted for your current practice baseline.",
    detail: "Combines curated question blocks aligned with your highest-leverage improvement areas.",
    time: "Guided plan",
    icon: "sparkles",
  },
};

export default function PlaySetupPage() {
  const { theme } = useThemeMode();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const modeParam = (params?.mode as string) || "adaptive";
  const initialExam = searchParams?.get("exam") || "ssc-cgl";

  const [exam, setExam] = useState(initialExam);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<number | "full">(modeParam === "section" ? 25 : 20);
  const [tier, setTier] = useState("1");
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { capabilities, error: capabilitiesError } = useTrainingCapabilities();
  const {
    dashboard,
    loading: dashboardLoading,
    error: dashboardError,
  } = useTrainingDashboard(exam);

  const selectedMode = useMemo(() => {
    const fromModes = modes.find((m) => m.id === modeParam);
    if (fromModes) return fromModes;
    return specialModes[modeParam] || {
      id: modeParam,
      title: modeParam.charAt(0).toUpperCase() + modeParam.slice(1),
      category: "AI",
      description: "Practice tailored to your target exam and topic mix.",
      detail: "Validated questions chosen for high-focus practice.",
      time: "Personalized mix",
      icon: "target",
    };
  }, [modeParam]);

  const category = (selectedMode.category || "AI").toLowerCase();
  const CategoryIcon = categoryIcons[category] || Sparkles;
  const ModeIcon = modeIcons[selectedMode.icon] || Sparkles;

  const selectedPolicy = capabilities?.modes[modeParam];

  const examOptions = useMemo(() => {
    return (capabilities?.exams || [
      { id: "ssc-cgl", label: "SSC CGL" },
      { id: "ssc-chsl", label: "SSC CHSL" },
      { id: "cat", label: "CAT" },
    ]).map((item) => ({ value: item.id, label: item.label }));
  }, [capabilities]);

  const examLabel = examOptions.find((e) => e.value === exam)?.label || exam.toUpperCase().replace("-", " ");

  const topicOptions = useMemo(() => {
    if (subject) {
      return (
        dashboard?.catalog
          .filter((item) => item.subject === subject)
          .map((item) => item.topic) || []
      );
    }
    return dashboard?.catalogTopics || [];
  }, [subject, dashboard]);

  const currentTier = tier || "1";
  const expectedMarking = useMemo(() => {
    if (exam === "cat") return { correct: 3, wrong: 1 };
    if (currentTier === "2") return { correct: 3, wrong: 1 };
    return { correct: 2, wrong: 0.5 };
  }, [exam, currentTier]);

  const startSession = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/training/sessions", {
        mode: modeParam,
        exam,
        tier,
        subject: modeParam === "mission" ? undefined : subject || undefined,
        topic: modeParam === "mission" ? undefined : topic || undefined,
        count,
        minutes,
      });
      router.push(`/play/session/${data.id}`);
    } catch (e) {
      setError(
        isAxiosError(e)
          ? e.response?.data?.error || "Could not start the session. Please retry."
          : "Could not start training.",
      );
      setBusy(false);
    }
  }, [modeParam, exam, tier, subject, topic, count, minutes, busy, router]);

  const isFormDisabled = busy || dashboardLoading;
  const requiresSubjectMissing = !!selectedPolicy?.requiresSubject && !subject;

  return (
    <div className={`play-setup-page training-page ${theme === "dark" ? "training-dark" : ""}`}>
      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <header className="play-setup-header" data-ui-chrome="header">
        <div className="play-setup-header-inner">
          <div className="play-setup-header-left">
            <Link
              href="/play"
              className="play-setup-back-btn"
              aria-label="Back to Play"
            >
              <ArrowLeft size={19} strokeWidth={2.2} />
            </Link>
            <div className="play-setup-title-wrap">
              <h1 className="play-setup-page-title">Start Session</h1>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Setup Body ────────────────────────────────────────────── */}
      <main className="play-setup-body" aria-label="Session setup">
        {/* Hero Mode Card */}
        <section
          className={`play-setup-hero play-setup-hero--${category}`}
          aria-label="Selected Mode Overview"
        >
          <div className={`play-setup-hero-icon play-setup-hero-icon--${category}`} aria-hidden="true">
            <ModeIcon size={26} strokeWidth={2.2} />
          </div>
          <div className="play-setup-hero-content">
            <div className="play-setup-badge-row">
              <span className={`play-setup-cat-badge play-setup-cat--${category}`}>
                <CategoryIcon size={12} strokeWidth={2.4} aria-hidden="true" />
                {selectedMode.category}
              </span>
            </div>
            <h2 className="play-setup-mode-title">{selectedMode.title}</h2>
            <p className="play-setup-mode-desc">
              {selectedMode.detail || selectedMode.description}
            </p>
          </div>
        </section>

        {/* Preparing Session Indicator when busy */}
        {busy && (
          <TrainingLoading
            title="Building your session…"
            description="Selecting verified questions and configuring timing. Your training session will start immediately."
            skeleton={false}
          />
        )}

        {/* Error Alert */}
        {(error || capabilitiesError || dashboardError) && (
          <div role="alert" className="play-setup-error">
            <span>{error || capabilitiesError || dashboardError}</span>
            <button
              type="button"
              className="setup-close-btn"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Session Setup Configuration Rows ─────────────────────────── */}
        <section className="play-setup-section" aria-labelledby="session-setup-title">
          <div className="play-setup-section-head">
            <h3 id="session-setup-title" className="play-setup-section-title">
              Session Setup
            </h3>
            <p className="play-setup-section-subtitle">
              Configure your practice session
            </p>
          </div>

          <fieldset
            className="play-setup-settings-grid"
            disabled={isFormDisabled}
            aria-busy={isFormDisabled}
          >
            {/* 1. Exam Selection Row */}
            <TrainingSelectDropdown
              variant="card"
              label="Exam"
              value={exam}
              placeholder="Select target exam"
              options={examOptions}
              disabled={isFormDisabled}
              icon={<Award size={20} strokeWidth={2.2} />}
              iconBgClass="tsd-icon-tile--blue"
              onChange={(val) => {
                if (val !== exam) {
                  setExam(val);
                  setSubject("");
                  setTopic("");
                }
              }}
            />

            {/* 2. Tier Selection Row (only when supported and not CAT) */}
            {selectedPolicy?.supportsTier && exam !== "cat" && (
              <TrainingSelectDropdown
                variant="card"
                label="Tier"
                value={tier}
                placeholder="Select tier"
                options={[
                  { value: "1", label: "Tier I (+2 / −0.5)" },
                  { value: "2", label: "Tier II (+3 / −1.0)" },
                ]}
                disabled={isFormDisabled}
                icon={<BarChart2 size={20} strokeWidth={2.2} />}
                iconBgClass="tsd-icon-tile--blue"
                onChange={setTier}
              />
            )}

            {/* 3. Subject Selection Row */}
            <TrainingSelectDropdown
              variant="card"
              label="Subject"
              value={subject}
              placeholder={selectedPolicy?.requiresSubject ? "Choose a subject" : "All subjects"}
              options={[
                { value: "", label: selectedPolicy?.requiresSubject ? "Choose a subject" : "All subjects" },
                ...[...new Set(dashboard?.subjects || [])].map((s) => ({ value: s, label: s })),
              ]}
              disabled={isFormDisabled}
              icon={<BookOpen size={20} strokeWidth={2.2} />}
              iconBgClass="tsd-icon-tile--purple"
              onChange={(val) => {
                if (val !== subject) {
                  setSubject(val);
                  setTopic("");
                }
              }}
            />

            {/* 4. Topic Searchable Picker Row */}
            <TrainingFilterPicker
              variant="card"
              label="Topic"
              value={topic}
              options={topicOptions}
              emptyLabel="Balanced topic mix"
              icon={<Target size={20} strokeWidth={2.2} />}
              iconBgClass="tsd-icon-tile--green"
              onChange={setTopic}
            />

            {/* 5. Number of Questions Row */}
            <TrainingSelectDropdown
              variant="card"
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
              disabled={isFormDisabled}
              icon={<FileText size={20} strokeWidth={2.2} />}
              iconBgClass="tsd-icon-tile--orange"
              onChange={(val) => setCount(val === "full" ? "full" : Number(val))}
            />

            {/* 6. Time / Clock Row (only for fixed-clock modes) */}
            {selectedPolicy?.clock === "fixed" && (
              <TrainingSelectDropdown
                variant="card"
                label="Time"
                value={String(minutes)}
                placeholder="10 minutes"
                placement="top"
                options={(selectedPolicy.minuteOptions.length
                  ? selectedPolicy.minuteOptions
                  : [5, 10, 15]
                ).map((n) => ({ value: String(n), label: `${n} minutes` }))}
                disabled={isFormDisabled}
                icon={<Timer size={20} strokeWidth={2.2} />}
                iconBgClass="tsd-icon-tile--amber"
                onChange={(val) => setMinutes(Number(val))}
              />
            )}
          </fieldset>
        </section>

        {/* ── Official Scoring Card ────────────────────────────────────── */}
        <section className="play-setup-scoring-card" aria-label="Official Scoring Information">
          <div className="play-setup-scoring-icon" aria-hidden="true">
            <Info size={17} strokeWidth={2.4} />
          </div>
          <div className="play-setup-scoring-content">
            <div className="play-setup-scoring-head">
              <span className="play-setup-scoring-title">
                Official {examLabel} {selectedPolicy?.supportsTier && exam !== "cat" ? `Tier ${currentTier === "2" ? "II" : "I"}` : ""} Scoring:
              </span>
              <div className="play-setup-scoring-pills">
                <span className="play-setup-pill-pos">+{expectedMarking.correct} correct</span>
                <span className="play-setup-pill-neg">−{expectedMarking.wrong} wrong</span>
                <span className="play-setup-pill-zero">0 skip</span>
              </div>
            </div>
            <p className="play-setup-scoring-desc">
              {expectedMarking.wrong > 0
                ? `${Math.round(expectedMarking.correct / expectedMarking.wrong)} wrong answers cancel 1 correct answer (+${expectedMarking.correct}). Unattempted questions carry zero penalty.`
                : "Practice scoring is recorded on submission. Unattempted questions carry zero penalty."}
            </p>
          </div>
        </section>

        {/* ── Live Session Summary ─────────────────────────────────────── */}
        <section className="play-setup-section" aria-labelledby="session-summary-title">
          <div className="play-setup-section-head">
            <h3 id="session-summary-title" className="play-setup-section-title">
              Session Summary
            </h3>
            <p className="play-setup-section-subtitle">
              Here&apos;s what you&apos;ll start with
            </p>
          </div>

          <div className="play-setup-summary-card" aria-label="Session parameters breakdown">
            {/* Mode cell */}
            <div className="play-setup-summary-item">
              <div className="play-setup-summary-header">
                <CategoryIcon size={13} className="play-setup-summary-icon" aria-hidden="true" />
                <span>Mode</span>
              </div>
              <span className="play-setup-summary-value">{selectedMode.title}</span>
            </div>

            {/* Exam cell */}
            <div className="play-setup-summary-item">
              <div className="play-setup-summary-header">
                <Award size={13} className="play-setup-summary-icon" aria-hidden="true" />
                <span>Exam</span>
              </div>
              <span className="play-setup-summary-value">{examLabel}</span>
            </div>

            {/* Tier cell (when applicable) */}
            {selectedPolicy?.supportsTier && exam !== "cat" && (
              <div className="play-setup-summary-item">
                <div className="play-setup-summary-header">
                  <BarChart2 size={13} className="play-setup-summary-icon" aria-hidden="true" />
                  <span>Tier</span>
                </div>
                <span className="play-setup-summary-value">
                  {currentTier === "2" ? "Tier II (+3/−1)" : "Tier I (+2/−0.5)"}
                </span>
              </div>
            )}

            {/* Subject cell */}
            <div className="play-setup-summary-item">
              <div className="play-setup-summary-header">
                <BookOpen size={13} className="play-setup-summary-icon" aria-hidden="true" />
                <span>Subject</span>
              </div>
              <span className="play-setup-summary-value">
                {subject || "All subjects"}
              </span>
            </div>

            {/* Topic cell */}
            <div className="play-setup-summary-item">
              <div className="play-setup-summary-header">
                <Target size={13} className="play-setup-summary-icon" aria-hidden="true" />
                <span>Topic</span>
              </div>
              <span className="play-setup-summary-value">
                {topic || "Balanced mix"}
              </span>
            </div>

            {/* Questions cell */}
            <div className="play-setup-summary-item">
              <div className="play-setup-summary-header">
                <FileText size={13} className="play-setup-summary-icon" aria-hidden="true" />
                <span>Questions</span>
              </div>
              <span className="play-setup-summary-value">
                {count === "full" ? "Full section" : `${count} questions`}
              </span>
            </div>

            {/* Timing cell */}
            <div className="play-setup-summary-item">
              <div className="play-setup-summary-header">
                <Clock size={13} className="play-setup-summary-icon" aria-hidden="true" />
                <span>Timing</span>
              </div>
              <span className="play-setup-summary-value">
                {selectedPolicy?.clock === "fixed"
                  ? `${minutes} min clock`
                  : selectedMode.time || "Adaptive pace"}
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Persistent Sticky Bottom Action Area ─────────────────────────── */}
      <footer className="play-setup-sticky-footer" data-ui-chrome="footer">
        <div className="play-setup-footer-inner">
          <div className="play-setup-footer-meta">
            <span className="play-setup-footer-meta-title">
              {count === "full" ? "Full section" : `${count} questions`} · {subject || "Personalized mix"}
            </span>
            <span className="play-setup-footer-meta-sub">
              {examLabel} · {selectedMode.title}
            </span>
          </div>

          <button
            type="button"
            className="play-setup-start-btn"
            disabled={isFormDisabled || requiresSubjectMissing}
            onClick={startSession}
          >
            <span>{busy ? "Building your session…" : "Begin training"}</span>
            {busy ? (
              <LoaderCircle className="play-setup-loading-spin" size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={18} strokeWidth={2.4} />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
