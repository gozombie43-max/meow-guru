import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Zap, Menu, Layers3, ListChecks, Trophy,
} from "lucide-react";

interface PracticeMode {
  title: string;
  slug: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  glow: string;
  chipLabel: string;
}

const modes: PracticeMode[] = [
  {
    title: "All Concepts",
    slug: "all",
    description:
      "Practice the full Mensuration bank across circle, area, volume, and mixed exam patterns.",
    icon: <Layers3 className="w-6 h-6" />,
    accent: "text-cyan-500",
    glow: "hover:border-cyan-400/30 hover:shadow-[0_0_24px_rgba(0,229,255,0.15)]",
    chipLabel: "Full Practice",
  },
  {
    title: "Each Concept",
    slug: "concept",
    description:
      "Start concept-wise practice and choose a specific Mensuration concept before beginning.",
    icon: <ListChecks className="w-6 h-6" />,
    accent: "text-teal-500",
    glow: "hover:border-teal-400/30 hover:shadow-[0_0_24px_rgba(38,198,218,0.15)]",
    chipLabel: "Concept Wise",
  },
  {
    title: "Tier 2",
    slug: "tier2",
    description:
      "Attempt only SSC Tier 2 level Mensuration questions for high-difficulty exam simulation.",
    icon: <Trophy className="w-6 h-6" />,
    accent: "text-amber-500",
    glow: "hover:border-amber-400/30 hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    chipLabel: "High Difficulty",
  },
];

export default function MensurationPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-500" />
            <span className="text-xl font-bold tracking-tight gradient-text font-sans">
              SSC AI
            </span>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Menu">
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </nav>

      <section className="relative pt-28 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/mathematics"
            className="animate-fade-in-up inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-primary)] transition-colors mb-10 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Mathematics</span>
          </Link>

          <div className="flex items-center gap-4 mb-3">
            <div
              className="animate-fade-in-up w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center"
              style={{ animationDelay: "100ms" }}
            >
              <span className="text-2xl">📏</span>
            </div>
            <h1
              className="animate-fade-in-up text-[clamp(2rem,5vw,3rem)] font-bold tracking-tight text-[var(--text-primary)]"
              style={{ animationDelay: "150ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
            >
              <span className="gradient-text">Mensuration</span>
            </h1>
          </div>
          <p
            className="animate-fade-in-up text-slate-500 text-[clamp(0.95rem,1.8vw,1.1rem)] max-w-2xl leading-relaxed mb-2"
            style={{ animationDelay: "250ms" }}
          >
            725 questions from SSC CGL, CHSL, CPO, MTS and Tier 2 patterns.
            Choose how you want to start.
          </p>

          <div
            className="animate-fade-in-up flex flex-wrap items-center gap-4 mt-6"
            style={{ animationDelay: "300ms" }}
          >
            {[
              { label: "Questions", value: "725" },
              { label: "Start Modes", value: "3" },
              { label: "Difficulty Levels", value: "3" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm"
              >
                <span className="text-[var(--text-primary)] font-semibold">{s.value}</span>
                <span className="text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-6 pt-8 pb-32">
        <div className="max-w-5xl mx-auto">
          <h2
            className="animate-fade-in-up text-xl font-semibold mb-8 text-[var(--text-primary)]"
            style={{ animationDelay: "350ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
          >
            Choose Start Option
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modes.map((mode, i) => (
              <Link
                key={mode.slug}
                href={`/mathematics/mensuration/quiz?mode=${mode.slug}`}
                className={`glass-card ${mode.glow} rounded-2xl p-7 cursor-pointer group animate-fade-in-up block`}
                style={{ animationDelay: `${400 + i * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`${mode.accent}`}>{mode.icon}</div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/20 text-slate-500 border border-white/30">
                    {mode.chipLabel}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2 tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
                  {mode.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">
                  {mode.description}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors group-hover:text-[var(--text-primary)]">
                  <span>Start Session</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
    </div>
  );
}
