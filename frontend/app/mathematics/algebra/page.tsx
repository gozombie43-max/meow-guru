import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Zap, Menu, Brain, Sparkles, Shuffle, Flame,
} from "lucide-react";

/* ── Practice Modes ───────────────────────────────────── */

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
    title: "Concept Practice",
    slug: "concept",
    description:
      "Practice questions grouped by concept — identities, quadratics, surds, and more. Build strong fundamentals.",
    icon: <Brain className="w-6 h-6" />,
    accent: "text-cyan-500",
    glow: "hover:border-cyan-400/30 hover:shadow-[0_0_24px_rgba(0,229,255,0.15)]",
    chipLabel: "Fundamentals",
  },
  {
    title: "Formula Practice",
    slug: "formula",
    description:
      "Each question shows the relevant formula. Learn to identify and apply the right formula quickly.",
    icon: <Sparkles className="w-6 h-6" />,
    accent: "text-teal-500",
    glow: "hover:border-teal-400/30 hover:shadow-[0_0_24px_rgba(38,198,218,0.15)]",
    chipLabel: "Formula Drills",
  },
  {
    title: "Mixed Practice",
    slug: "mixed",
    description:
      "Random questions across all concepts and difficulty levels. Simulate real exam conditions.",
    icon: <Shuffle className="w-6 h-6" />,
    accent: "text-indigo-400",
    glow: "hover:border-indigo-400/30 hover:shadow-[0_0_24px_rgba(165,180,252,0.20)]",
    chipLabel: "Exam Simulation",
  },
  {
    title: "AI Challenge Mode",
    slug: "ai-challenge",
    description:
      "AI generates harder variants of real questions. Push your limits with dynamically scaled difficulty.",
    icon: <Flame className="w-6 h-6" />,
    accent: "text-sky-400",
    glow: "hover:border-sky-400/30 hover:shadow-[0_0_24px_rgba(0,180,220,0.15)]",
    chipLabel: "Advanced",
  },
];

/* ── Page ──────────────────────────────────────────────── */

export default function AlgebraPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── Navigation ── */}
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

      {/* ── Page Header ── */}
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
              className="animate-fade-in-up w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center"
              style={{ animationDelay: "100ms" }}
            >
              <span className="text-2xl">✖️</span>
            </div>
            <h1
              className="animate-fade-in-up text-[clamp(2rem,5vw,3rem)] font-bold tracking-tight text-[var(--text-primary)]"
              style={{ animationDelay: "150ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
            >
              <span className="gradient-text">Algebra</span>
            </h1>
          </div>
          <p
            className="animate-fade-in-up text-slate-500 text-[clamp(0.95rem,1.8vw,1.1rem)] max-w-2xl leading-relaxed mb-2"
            style={{ animationDelay: "250ms" }}
          >
            377 questions from SSC CGL, CHSL &amp; MTS exams. Choose a practice
            mode to begin your session.
          </p>

          {/* Stats row */}
          <div
            className="animate-fade-in-up flex flex-wrap items-center gap-4 mt-6"
            style={{ animationDelay: "300ms" }}
          >
            {[
              { label: "Questions", value: "377" },
              { label: "Concepts", value: "7" },
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

      {/* ── Practice Mode Cards ── */}
      <section className="relative px-6 pt-8 pb-32">
        <div className="max-w-5xl mx-auto">
          <h2
            className="animate-fade-in-up text-xl font-semibold mb-8 text-[var(--text-primary)]"
            style={{ animationDelay: "350ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
          >
            Choose Practice Mode
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modes.map((mode, i) => (
              <Link
                key={mode.slug}
                href={`/mathematics/algebra/quiz?mode=${mode.slug}`}
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
                <div className={`flex items-center gap-1.5 text-sm text-slate-500 group-hover:${mode.accent.replace("text-", "text-")} transition-colors`}>
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
