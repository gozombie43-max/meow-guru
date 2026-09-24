import { useRef } from "react";
import { useNativeDialog } from "@/components/ui/Dialog";
import {
  Brain,
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
  ArrowRight
} from "lucide-react";
import { TrainingFilterPicker } from "@/components/training/TrainingFilterPicker";
import { TrainingSelectDropdown } from "@/components/training/TrainingSelectDropdown";
import { TrainingLoading } from "@/components/training/TrainingLoading";
import { type ModeId, modes, type TrainingDashboard, type TrainingCapabilities } from "@/components/training/training-types";

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

interface TrainingSetupDialogProps {
  selected: ModeId | null;
  setSelected: (mode: ModeId | null) => void;
  exam: string;
  theme: string | undefined;
  dashboard: TrainingDashboard | null;
  capabilities: TrainingCapabilities | null;
  loading: boolean;
  busy: boolean;
  error: string;
  subject: string;
  setSubject: (s: string) => void;
  topic: string;
  setTopic: (t: string) => void;
  count: number | "full";
  setCount: (c: number | "full") => void;
  tier: string;
  setTier: (t: string) => void;
  minutes: number;
  setMinutes: (m: number) => void;
  start: () => void;
}

export function TrainingSetupDialog({
  selected,
  setSelected,
  exam,
  theme,
  dashboard,
  capabilities,
  loading,
  busy,
  error,
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
  start
}: TrainingSetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useNativeDialog(dialogRef, !!selected, () => setSelected(null), { busy });
  if (!selected) return null;

  const selectedMode = modes.find((m) => m.id === selected);
  const selectedPolicy = capabilities?.modes[selected];
  
  const topicOptions = subject
    ? dashboard?.catalog
        .filter((item) => item.subject === subject)
        .map((item) => item.topic) || []
    : dashboard?.catalogTopics || [];

  const currentTier = tier || "1";
  const expectedMarking =
    exam === "cat"
      ? { correct: 3, wrong: 1 }
      : currentTier === "2"
        ? { correct: 3, wrong: 1 }
        : { correct: 2, wrong: 0.5 };

  return (
    <dialog
      ref={dialogRef}
      id="training-setup"
      aria-labelledby="training-setup-title"
      aria-describedby="training-setup-description"
      className={`training-setup play-setup ${theme === "dark" ? "training-dark" : ""}`}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else setSelected(null);
      }}
    >
      <div className="setup-sheet-handle" aria-hidden="true" />

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
                { value: "1", label: "Tier I (+2 / −0.5)" },
                { value: "2", label: "Tier II (+3 / −1.0)" },
              ]}
              disabled={busy || loading}
              onChange={setTier}
            />
          )}

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

          <TrainingFilterPicker
            label="Topic"
            value={topic}
            options={topicOptions}
            emptyLabel="Balanced topic mix"
            onChange={setTopic}
          />

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

        <div className="setup-info-card">
          <div className="setup-info-icon">
            <Info size={16} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <div className="setup-info-text">
            <div className="setup-marking-overview">
              <strong>
                Official {exam.toUpperCase().replaceAll("-", " ")} {selectedPolicy?.supportsTier && exam !== "cat" ? `Tier ${currentTier === "2" ? "II" : "I"}` : ""} Scoring:
              </strong>
              <div className="setup-marking-pills">
                <span className="setup-pill-pos">+{expectedMarking.correct} correct</span>
                <span className="setup-pill-neg">−{expectedMarking.wrong} wrong</span>
                <span className="setup-pill-zero">0 skip</span>
              </div>
            </div>
            <p>
              {expectedMarking.wrong > 0
                ? `${(expectedMarking.correct / expectedMarking.wrong).toFixed(0)} wrong answers cancel 1 correct answer (+${expectedMarking.correct}). Unattempted questions carry zero penalty.`
                : "Practice scoring is applied by the server. The clock continues if you leave."}
            </p>
          </div>
        </div>

        {error && (
          <p className="training-error" role="alert">
            {error}
          </p>
        )}
      </div>

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
  );
}
