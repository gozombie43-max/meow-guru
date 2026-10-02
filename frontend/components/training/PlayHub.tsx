import {
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  Gamepad2,
  RotateCcw,
  Shield,
  Sparkles,
  Target,
} from "lucide-react";
import { type TrainingDashboard } from "./training-types";

const areas = [
  { label: "Play", icon: Gamepad2, caption: "Explore training modes" },
  { label: "Train Me", icon: Sparkles, caption: "Your daily mission" },
  { label: "Mock", icon: BookOpenCheck, caption: "Get exam ready" },
  { label: "Review", icon: RotateCcw, caption: "Revisit and remember" },
  { label: "Analytics", icon: BarChart3, caption: "Understand your progress" },
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
      className="play-progress"
      aria-label="Your training snapshot"
      aria-busy={loading}
    >
      <h2>Your progress</h2>
      <div className="play-pulse">
        {stats.map(({ label, value, icon: Icon, tab }) => (
          <button
            key={label}
            data-ui-button="state"
            aria-label={`${label}: ${loading || value == null ? "none" : value}. View ${tab}`}
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
      </div>
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
      <span className="play-mission-action">
        Start
      </span>
    </button>
  );
}
