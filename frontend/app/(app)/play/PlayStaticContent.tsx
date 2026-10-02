import Link from "next/link";
import {
  Brain,
  Target,
  Zap,
  Timer,
  Layers,
  Route,
  Flame,
  Shield,
  Clock3,
  Sparkles,
} from "lucide-react";
import { modes } from "@/components/training/training-types";
import { PlayModeButton } from "./PlayClient";

export function PlayBrand() {
  return (
    <Link href="/play" prefetch={false} className="training-brand">
      <span className="training-brand-icon">
        <Target size={18} strokeWidth={2.2} />
      </span>
      <span className="training-brand-name">Play</span>
      <span className="training-brand-caption">
        MEOW GURU / TRAINING STUDIO
      </span>
    </Link>
  );
}

export function PlaySideNote() {
  return (
    <div className="training-side-note">
      <Target size={24} />
      <strong>Train with intent.</strong>
      <p>Choose an objective. Measure the work. Come back stronger.</p>
    </div>
  );
}

export function PlayHeading({ tab }: { tab: string }) {
  return (
    <>
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
    </>
  );
}

const icons = {
  brain: Brain,
  target: Target,
  zap: Zap,
  timer: Timer,
  layers: Layers,
  route: Route,
  flame: Flame,
  shield: Shield,
};

export function PlayModeLibrary() {
  return (
    <section aria-labelledby="play-modes-title" className="play-library">
      <div className="training-mode-bar">
        <div>
          <h2 id="play-modes-title">
            Training modes
            <span>{modes.length}</span>
          </h2>
        </div>
      </div>
      <div className="training-mode-grid">
        {modes.map((mode) => {
          const Icon = icons[mode.icon];
          return (
            <PlayModeButton
              key={mode.id}
              mode={mode.id}
              className={`training-mode-card training-category-${mode.category.toLowerCase()}`}
              label={`Set up ${mode.title}`}
            >
              <div className="training-card-top">
                <span className="training-mode-icon">
                  <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="play-category">{mode.category}</span>
              </div>
              <span className="play-card-title">{mode.title}</span>
              <span className="training-mode-description">
                {mode.description}
              </span>
              <div className="training-card-bottom">
                <span className="play-card-time">
                  {mode.category === "Speed" ? (
                    <Clock3 size={13} aria-hidden="true" />
                  ) : mode.category === "Extreme" ? (
                    <Flame size={13} aria-hidden="true" />
                  ) : mode.category === "AI" ? (
                    <Sparkles size={13} aria-hidden="true" />
                  ) : (
                    <Layers size={13} aria-hidden="true" />
                  )}
                  {mode.time}
                </span>
                <span className="play-configure">Set up</span>
              </div>
            </PlayModeButton>
          );
        })}
      </div>
      <p className="training-footnote">
        <Shield size={14} aria-hidden="true" /> Every session builds the same
        profile. Your progress stays connected.
      </p>
    </section>
  );
}
