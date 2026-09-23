"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Clock3,
  Flame,
  GraduationCap,
  Info,
  Layers,
  ListChecks,
  LoaderCircle,
  Route,
  Shield,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";

import { useThemeMode } from "@/hooks/useTheme";
import { TrainingFilterPicker } from "@/components/training/TrainingFilterPicker";
import { TrainingSelectDropdown } from "@/components/training/TrainingSelectDropdown";
import { TrainingLoading } from "@/components/training/TrainingLoading";
import {
  modes,
  type ModeId,
} from "@/components/training/training-types";
import { useTrainingCapabilities } from "../../hooks/useTrainingCapabilities";
import { useTrainingDashboard } from "../../hooks/useTrainingDashboard";
import { useTrainingSetup } from "../../hooks/useTrainingSetup";

type IconType = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

const modeIcons: Record<string, IconType> = {
  brain: Brain,
  target: Target,
  zap: Zap,
  timer: Timer,
  layers: Layers,
  route: Route,
  flame: Flame,
  shield: Shield,
};

const fieldIcons = {
  exam: GraduationCap,
  tier: Layers,
  subject: BookOpen,
  topic: Target,
  questions: ListChecks,
  clock: Clock3,
};

const reviewMode = {
  id: "review",
  title: "Smart review",
  category: "AI",
  detail: "Revisit questions that are due for spaced review and strengthen weak recall.",
  time: "Due review queue",
  icon: "brain",
} as const;

function FieldCard({
  icon: Icon,
  children,
}: {
  icon: IconType;
  children: ReactNode;
}) {
  return (
    <div className="setup-page-field">
      <span className="setup-page-field-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="setup-page-field-control">{children}</div>
    </div>
  );
}

export default function SessionSetupClient({
  modeParam,
  examParam,
}: {
  modeParam: string;
  examParam?: string;
}) {
  const { theme } = useThemeMode();
  const router = useRouter();
  const [exam, setExam] = useState(examParam || "ssc-cgl");

  const mode =
    modeParam === "review" || modes.some((item) => item.id === modeParam)
      ? (modeParam as ModeId)
      : null;

  const modeMeta =
    modes.find((item) => item.id === mode) ||
    (mode === "review" ? reviewMode : null);

  const { capabilities, error: capabilitiesError } =
    useTrainingCapabilities();
  const {
    dashboard,
    loading,
    error: dashboardError,
  } = useTrainingDashboard(exam);
  const {
    selected,
    subject,
    setSubject,
    topic,
    setTopic,
    count,
    setCount,
    tier,
    setTier,
    minutes,
    setMinutes,
    busy,
    error: setupError,
    setError: setSetupError,
    choose,
    start,
  } = useTrainingSetup(exam);

  const policy = mode ? capabilities?.modes[mode] : undefined;
  const error = capabilitiesError || dashboardError || setupError;

  useEffect(() => {
    if (!mode || !capabilities || !policy || selected === mode) return;
    choose(mode, true);
  }, [mode, capabilities, policy, selected, choose]);

  if (!mode || !modeMeta) {
    return (
      <div
        className={
          "training-page play-setup-page " +
          (theme === "dark" ? "training-dark" : "")
        }
      >
        <main className="setup-page-invalid">
          <Target size={30} aria-hidden="true" />
          <h1>Session setup unavailable</h1>
          <p>This training mode is not available.</p>
          <button data-ui-button="primary" onClick={() => router.push("/play")}>
            Back to Play
          </button>
        </main>
      </div>
    );
  }

  const categoryKey = ["ai", "speed", "sectional", "extreme"].includes(
    modeMeta.category.toLowerCase(),
  )
    ? modeMeta.category.toLowerCase()
    : "ai";
  const ModeIcon = modeIcons[modeMeta.icon] || Sparkles;

  const topicOptions = subject
    ? dashboard?.catalog
        .filter((item) => item.subject === subject)
        .map((item) => item.topic) || []
    : dashboard?.catalogTopics || [];

  const examOptions =
    capabilities?.exams || [
      { id: "ssc-cgl", label: "SSC CGL" },
      { id: "ssc-chsl", label: "SSC CHSL" },
      { id: "cat", label: "CAT" },
    ];

  const currentTier = tier || "1";
  const expectedMarking =
    exam === "cat"
      ? { correct: 3, wrong: 1 }
      : currentTier === "2"
        ? { correct: 3, wrong: 1 }
        : { correct: 2, wrong: 0.5 };

  const examLabel =
    examOptions.find((item) => item.id === exam)?.label ||
    exam.toUpperCase().replaceAll("-", " ");
  const subjectLabel = subject || "All subjects";
  const topicLabel = topic || "Balanced topic mix";
  const questionLabel =
    count === "full" ? "Full configured section" : count + " questions";
  const clockLabel =
    policy?.clock === "fixed"
      ? minutes + " min"
      : modeMeta.time || "Target based";
  const tierLabel =
    currentTier === "2" ? "Tier II (+3 / −1.0)" : "Tier I (+2 / −0.5)";

  const unavailable = !capabilities || !policy || loading;
  const cannotStart =
    busy ||
    unavailable ||
    !selected ||
    (!!policy?.requiresSubject && !subject);

  return (
    <div
      className={
        "training-page play-setup-page " +
        (theme === "dark" ? "training-dark" : "")
      }
    >
      <header className="setup-page-header">
        <button
          type="button"
          className="setup-page-back"
          aria-label="Back to Play"
          onClick={() => router.back()}
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </button>
        <div>
          <span>MEOW GURU / TRAINING</span>
          <h1>Start Session</h1>
        </div>
      </header>

      <main className="setup-page-main" aria-label="Session setup">
        <section
          className={"setup-page-hero setup-page-hero--" + categoryKey}
          aria-labelledby="setup-mode-title"
        >
          <div
            className={"setup-page-mode-icon setup-icon--" + categoryKey}
            aria-hidden="true"
          >
            <ModeIcon size={28} strokeWidth={2.2} />
          </div>
          <div className="setup-page-hero-copy">
            <span className={"setup-cat-badge setup-cat--" + categoryKey}>
              <Sparkles size={12} strokeWidth={2.4} aria-hidden="true" />
              {modeMeta.category}
            </span>
            <h2 id="setup-mode-title">{modeMeta.title}</h2>
            <p>{modeMeta.detail}</p>
          </div>
        </section>

        <section className="setup-page-section" aria-labelledby="setup-heading">
          <div className="setup-page-section-heading">
            <div>
              <p className="training-kicker">SESSION SETUP</p>
              <h2 id="setup-heading">Configure your practice</h2>
            </div>
            <span>Everything can be changed before you begin.</span>
          </div>

          {busy && (
            <TrainingLoading
              title="Preparing your questions"
              description="Choosing questions for your mode and selected topics. Your session will open when ready."
              skeleton={false}
            />
          )}

          <fieldset
            className="setup-page-grid"
            disabled={busy || loading}
            aria-busy={busy || loading}
          >
            <FieldCard icon={fieldIcons.exam}>
              <TrainingSelectDropdown
                label="Exam"
                value={exam}
                placeholder="Choose exam"
                options={examOptions.map((item) => ({
                  value: item.id,
                  label: item.label,
                }))}
                disabled={busy}
                onChange={(value) => {
                  if (value === exam) return;
                  setExam(value);
                  setTier("1");
                  setSubject("");
                  setTopic("");
                  setSetupError("");
                }}
              />
            </FieldCard>

            {policy?.supportsTier && exam !== "cat" && (
              <FieldCard icon={fieldIcons.tier}>
                <TrainingSelectDropdown
                  label="Tier"
                  value={tier}
                  placeholder="Select tier"
                  options={[
                    { value: "1", label: "Tier I (+2 / −0.5)" },
                    { value: "2", label: "Tier II (+3 / −1.0)" },
                  ]}
                  disabled={busy || loading}
                  onChange={setTier}
                />
              </FieldCard>
            )}

            <FieldCard icon={fieldIcons.subject}>
              <TrainingSelectDropdown
                label="Subject"
                value={subject}
                placeholder={
                  policy?.requiresSubject ? "Choose a subject" : "All subjects"
                }
                options={[
                  {
                    value: "",
                    label: policy?.requiresSubject
                      ? "Choose a subject"
                      : "All subjects",
                  },
                  ...[...new Set(dashboard?.subjects || [])].map((item) => ({
                    value: item,
                    label: item,
                  })),
                ]}
                disabled={busy || loading}
                onChange={(value) => {
                  if (value === subject) return;
                  setSubject(value);
                  setTopic("");
                }}
              />
            </FieldCard>

            <FieldCard icon={fieldIcons.topic}>
              <TrainingFilterPicker
                label="Topic"
                value={topic}
                options={topicOptions}
                emptyLabel="Balanced topic mix"
                onChange={setTopic}
              />
            </FieldCard>

            <FieldCard icon={fieldIcons.questions}>
              <TrainingSelectDropdown
                label="Questions"
                value={String(count)}
                placeholder="20 questions"
                placement="auto"
                options={[
                  ...[10, 20, 25, 50].map((item) => ({
                    value: String(item),
                    label: item + " questions",
                  })),
                  ...(policy?.supportsFullSection
                    ? [
                        {
                          value: "full",
                          label: "Full configured section",
                        },
                      ]
                    : []),
                ]}
                disabled={busy || loading}
                onChange={(value) =>
                  setCount(value === "full" ? "full" : Number(value))
                }
              />
            </FieldCard>

            {policy?.clock === "fixed" && (
              <FieldCard icon={fieldIcons.clock}>
                <TrainingSelectDropdown
                  label="Time"
                  value={String(minutes)}
                  placeholder="10 minutes"
                  placement="auto"
                  options={(policy.minuteOptions.length
                    ? policy.minuteOptions
                    : [5, 10, 15]
                  ).map((item) => ({
                    value: String(item),
                    label: item + " minutes",
                  }))}
                  disabled={busy || loading}
                  onChange={(value) => setMinutes(Number(value))}
                />
              </FieldCard>
            )}
          </fieldset>

          <div className="setup-page-scoring">
            <Info size={18} strokeWidth={2.3} aria-hidden="true" />
            <div>
              <strong>
                Official {examLabel}{" "}
                {policy?.supportsTier && exam !== "cat"
                  ? currentTier === "2"
                    ? "Tier II "
                    : "Tier I "
                  : ""}
                scoring
              </strong>
              <div className="setup-page-score-pills">
                <span>+{expectedMarking.correct} correct</span>
                <span>−{expectedMarking.wrong} wrong</span>
                <span>0 skip</span>
              </div>
              <p>
                {expectedMarking.wrong > 0
                  ? (expectedMarking.correct / expectedMarking.wrong).toFixed(0) +
                    " wrong answers cancel 1 correct answer (+" +
                    expectedMarking.correct +
                    "). Unattempted questions carry zero penalty."
                  : "Practice scoring is applied by the server. The clock continues if you leave."}
              </p>
            </div>
          </div>

          {error && (
            <div className="training-error setup-page-error" role="alert">
              {error}
            </div>
          )}
        </section>

        <section
          className="setup-page-section setup-page-summary-section"
          aria-labelledby="summary-heading"
        >
          <div className="setup-page-section-heading">
            <div>
              <p className="training-kicker">SESSION SUMMARY</p>
              <h2 id="summary-heading">Ready to begin</h2>
            </div>
            <span>Review the final setup before starting.</span>
          </div>

          <div className="setup-page-summary">
            <div>
              <Sparkles size={17} aria-hidden="true" />
              <span>Mode</span>
              <strong>{modeMeta.title}</strong>
            </div>
            <div>
              <GraduationCap size={17} aria-hidden="true" />
              <span>Exam</span>
              <strong>{examLabel}</strong>
            </div>
            {policy?.supportsTier && exam !== "cat" && (
              <div>
                <Layers size={17} aria-hidden="true" />
                <span>Tier</span>
                <strong>{tierLabel}</strong>
              </div>
            )}
            <div>
              <BookOpen size={17} aria-hidden="true" />
              <span>Subject</span>
              <strong>{subjectLabel}</strong>
            </div>
            <div>
              <Target size={17} aria-hidden="true" />
              <span>Topic</span>
              <strong>{topicLabel}</strong>
            </div>
            <div>
              <ListChecks size={17} aria-hidden="true" />
              <span>Questions</span>
              <strong>{questionLabel}</strong>
            </div>
            <div>
              <Clock3 size={17} aria-hidden="true" />
              <span>Timing</span>
              <strong>{clockLabel}</strong>
            </div>
          </div>
        </section>
      </main>

      <footer className="setup-page-footer" data-ui-chrome="footer">
        <div className="setup-page-footer-inner">
          <div className="setup-page-footer-copy">
            <span>{modeMeta.title}</span>
            <strong>{questionLabel} · {clockLabel}</strong>
          </div>
          <button
            type="button"
            className="setup-start-btn"
            disabled={cannotStart}
            onClick={() => start()}
          >
            <span>{busy ? "Building your session…" : "Begin training"}</span>
            {busy ? (
              <LoaderCircle
                className="setup-loading-spin"
                size={18}
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
