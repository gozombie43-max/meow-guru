import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
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
const categories = ["All modes", "AI", "Speed", "Sectional", "Extreme"];

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
          data-ui-button="state"
          aria-current={tab === label ? "page" : undefined}
          onClick={() => onChange(label)}
        >
          <Icon size={19} aria-hidden="true" />
          <span>
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
          <Icon size={20} aria-hidden="true" />
          <span>
            <strong>{loading || value == null ? "—" : value}</strong>
            <small>{label}</small>
          </span>
          <ChevronRight size={15} aria-hidden="true" />
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
        <label className="play-mobile-filter">
          <span className="sr-only">Mode category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="training-filters"
        role="group"
        aria-label="Mode categories"
      >
        {categories.map((name) => (
          <button
            key={name}
            data-ui-button="state"
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name === "All modes" && <Layers size={15} aria-hidden="true" />}
            {name}
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
              <span className="training-card-top">
                <span className="training-mode-icon">
                  <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="play-category">{mode.category}</span>
                <ArrowRight
                  className="play-card-arrow"
                  size={18}
                  aria-hidden="true"
                />
              </span>
              <span className="play-card-title">{mode.title}</span>
              <span className="training-mode-eyebrow">{mode.eyebrow}</span>
              <span className="training-mode-description">
                {mode.description}
              </span>
              <span className="training-card-bottom">
                <span>
                  <Clock3 size={13} aria-hidden="true" />
                  {mode.time}
                </span>
                <span className="play-configure">
                  Set up
                  <ChevronRight size={14} aria-hidden="true" />
                </span>
              </span>
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
