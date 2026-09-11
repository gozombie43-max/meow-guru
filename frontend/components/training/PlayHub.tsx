import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Brain,
  ChevronRight,
  Clock3,
  Flame,
  Gamepad2,
  Layers,
  RotateCcw,
  Route,
  Shield,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { modes, type ModeId, type TrainingDashboard } from "./training-types";

const areas = [
  { label: "Play", icon: Gamepad2, caption: "Explore training modes" },
  { label: "Train Me", icon: Sparkles, caption: "Your daily mission" },
  { label: "Mock", icon: BookOpenCheck, caption: "Get exam ready" },
  { label: "Review", icon: RotateCcw, caption: "Revisit and remember" },
  { label: "Analytics", icon: BarChart3, caption: "Understand your progress" },
];
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
const categoryConfigs = [
  { name: "All modes", icon: Layers },
  { name: "AI", icon: Sparkles },
  { name: "Speed", icon: Zap },
  { name: "Sectional", icon: BookOpen },
  { name: "Extreme", icon: Flame },
];

export function PlayNavigation({
  tab,
  onChange,
  mobile = false,
}: {
  tab: string;
  onChange: (tab: string) => void;
  mobile?: boolean;
}) {
  return (
    <nav
      className={mobile ? "training-mobile-tabs" : "play-navigation"}
      aria-label="Training areas"
    >
      {areas.map(({ label, icon: Icon, caption }) => (
        <button
          key={label}
          type="button"
          data-ui-button="state"
          aria-current={tab === label ? "page" : undefined}
          onClick={() => onChange(label)}
        >
          <span className="play-nav-icon-wrap">
            <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="play-nav-label">
            {label}
            {!mobile && <small>{caption}</small>}
          </span>
          {!mobile && <ChevronRight size={14} aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}

export function PlayPulse({
  dashboard,
  loading,
  onChange,
}: {
  dashboard: TrainingDashboard | null;
  loading: boolean;
  onChange: (tab: string) => void;
}) {
  const stats = [
    {
      label: "Answers recorded",
      value: dashboard?.attempts,
      icon: Target,
      tab: "Analytics",
    },
    {
      label: "Ready to review",
      value: dashboard?.due.length,
      icon: RotateCcw,
      tab: "Review",
    },
    {
      label: "Survival best",
      value: dashboard?.personalBest,
      icon: Shield,
      tab: "Analytics",
    },
  ];
  return (
    <section
      className="play-pulse"
      aria-label="Your training snapshot"
      aria-busy={loading}
    >
      {stats.map(({ label, value, icon: Icon, tab }) => (
        <button
          key={label}
          data-ui-button="state"
          onClick={() => onChange(tab)}
        >
          <span className="play-pulse-icon-badge">
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="play-pulse-info">
            <strong>{loading || value == null ? "—" : value}</strong>
            <small>{label}</small>
          </span>
          <ChevronRight className="play-pulse-arrow" size={15} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

export function PlayModeLibrary({
  onChoose,
}: {
  onChoose: (mode: ModeId) => void;
}) {
  const [category, setCategory] = useState("All modes");
  const visible = modes.filter(
    (mode) => category === "All modes" || mode.category === category,
  );
  return (
    <section aria-labelledby="play-modes-title" className="play-library">
      <div className="training-mode-bar">
        <div>
          <p className="training-kicker">FIND YOUR FOCUS</p>
          <h2 id="play-modes-title">
            Training modes
            <span>{visible.length.toString().padStart(2, "0")}</span>
          </h2>
        </div>
      </div>
      <div
        className="training-filters"
        role="group"
        aria-label="Mode categories"
      >
        {categoryConfigs.map(({ name, icon: CatIcon }) => (
          <button
            key={name}
            data-ui-button="state"
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            <CatIcon size={14} aria-hidden="true" />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <div className="training-mode-grid">
        {visible.map((mode) => {
          const Icon = icons[mode.icon];
          return (
            <button
              key={mode.id}
              className={`training-mode-card training-category-${mode.category.toLowerCase()}`}
              data-ui-button="state"
              aria-label={`Set up ${mode.title}`}
              onClick={() => onChoose(mode.id)}
            >
              <div className="training-card-top">
                <span className="training-mode-icon">
                  <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="play-category">{mode.category}</span>
              </div>
              <span className="play-card-title">{mode.title}</span>
              <span className="training-mode-eyebrow">{mode.eyebrow}</span>
              <span className="training-mode-description">
                {mode.description}
              </span>
              <div className="training-card-bottom">
                <span className="play-card-time">
                  <Clock3 size={13} aria-hidden="true" />
                  {mode.time}
                </span>
                <span className="play-configure">
                  Set up
                  <ChevronRight size={14} aria-hidden="true" />
                </span>
              </div>
            </button>
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

export function PlayMissionShortcut({
  loading,
  available,
  onOpen,
}: {
  loading: boolean;
  available: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      className="play-mission-shortcut"
      data-ui-button="state"
      disabled={loading || !available}
      onClick={onOpen}
    >
      <span className="play-mission-symbol">
        <Sparkles size={21} aria-hidden="true" />
      </span>
      <span>
        <strong>Your daily mission</strong>
        <small>
          {loading ? "Loading your plan…" : "A guided session, planned for you"}
        </small>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  );
}
