import Link from "next/link";
import { ArrowLeft, ArrowRight, Zap, Menu } from "lucide-react";

/* ── Topic data ───────────────────────────────────────── */

interface Topic {
  title: string;
  emoji: string;
  description: string;
  slug: string;
  accentColor: string;
  glowColor: string;
  bgGlow: string;
}

const topics: Topic[] = [
  {
    title: "Number System",
    emoji: "🔢",
    description:
      "Master HCF, LCM, divisibility rules, prime numbers, and number properties essential for SSC.",
    slug: "number-system",
    accentColor: "text-cyan-500",
    glowColor: "hover:border-cyan-400/30 hover:shadow-[0_0_24px_rgba(0,229,255,0.15)]",
    bgGlow: "bg-cyan-500/10",
  },
  {
    title: "Arithmetic",
    emoji: "➕",
    description:
      "Percentage, profit & loss, simple & compound interest, ratio & proportion, time & work.",
    slug: "arithmetic",
    accentColor: "text-teal-500",
    glowColor: "hover:border-teal-400/30 hover:shadow-[0_0_24px_rgba(38,198,218,0.15)]",
    bgGlow: "bg-teal-500/10",
  },
  {
    title: "Algebra",
    emoji: "✖️",
    description:
      "Linear equations, quadratic equations, polynomials, algebraic identities, and simplification.",
    slug: "algebra",
    accentColor: "text-indigo-400",
    glowColor: "hover:border-indigo-400/30 hover:shadow-[0_0_24px_rgba(165,180,252,0.20)]",
    bgGlow: "bg-indigo-400/10",
  },
  {
    title: "Geometry",
    emoji: "📐",
    description:
      "Lines, angles, triangles, circles, quadrilaterals, and coordinate geometry fundamentals.",
    slug: "geometry",
    accentColor: "text-sky-400",
    glowColor: "hover:border-sky-400/30 hover:shadow-[0_0_24px_rgba(0,180,220,0.15)]",
    bgGlow: "bg-sky-400/10",
  },
  {
    title: "Mensuration",
    emoji: "📏",
    description:
      "Area, perimeter, surface area, and volume of 2D and 3D shapes for competitive exams.",
    slug: "mensuration",
    accentColor: "text-cyan-400",
    glowColor: "hover:border-cyan-400/30 hover:shadow-[0_0_24px_rgba(0,229,255,0.15)]",
    bgGlow: "bg-cyan-400/10",
  },
  {
    title: "Trigonometry",
    emoji: "📊",
    description:
      "Trigonometric ratios, identities, heights & distances, and angle-based problem solving.",
    slug: "trigonometry",
    accentColor: "text-teal-400",
    glowColor: "hover:border-teal-400/30 hover:shadow-[0_0_24px_rgba(38,198,218,0.15)]",
    bgGlow: "bg-teal-400/10",
  },
  {
    title: "Statistics & Probability",
    emoji: "📈",
    description:
      "Mean, median, mode, data interpretation, and probability concepts for SSC examinations.",
    slug: "statistics-probability",
    accentColor: "text-indigo-300",
    glowColor: "hover:border-indigo-300/30 hover:shadow-[0_0_24px_rgba(165,180,252,0.15)]",
    bgGlow: "bg-indigo-300/10",
  },
];

/* ── Page ──────────────────────────────────────────────── */

export default function MathematicsPage() {
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
          <button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </nav>

      {/* ── Page Header ── */}
      <section className="relative pt-28 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Back button */}
          <Link
            href="/"
            className="animate-fade-in-up inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-primary)] transition-colors mb-10 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Subjects</span>
          </Link>

          {/* Page heading */}
          <div className="flex items-center gap-4 mb-3">
            <div
              className="animate-fade-in-up w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center"
              style={{ animationDelay: "100ms" }}
            >
              <span className="text-2xl">🧮</span>
            </div>
            <h1
              className="animate-fade-in-up text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-tight text-[var(--text-primary)]"
              style={{ animationDelay: "150ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
            >
              <span className="gradient-text">Mathematics</span> Topics
            </h1>
          </div>
          <p
            className="animate-fade-in-up text-slate-500 text-[clamp(0.95rem,1.8vw,1.1rem)] max-w-2xl leading-relaxed"
            style={{ animationDelay: "250ms" }}
          >
            Select a topic to start practicing. Each section contains AI-curated
            questions tailored for SSC CGL, CHSL, and MTS exams.
          </p>
        </div>
      </section>

      {/* ── Topic Cards ── */}
      <section className="relative px-6 pb-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic, i) => (
              <Link
                key={topic.slug}
                href={`/mathematics/${topic.slug}`}
                className={`glass-card ${topic.glowColor} rounded-2xl p-6 cursor-pointer group animate-fade-in-up block`}
                style={{ animationDelay: `${350 + i * 100}ms` }}
              >
                {/* Top row: emoji + arrow */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${topic.bgGlow} flex items-center justify-center`}
                  >
                    <span className="text-xl">{topic.emoji}</span>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 text-slate-400 ${topic.accentColor.replace("text-", "group-hover:text-")} transition-all group-hover:translate-x-1`}
                  />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold mb-2 tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
                  {topic.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-slate-500 leading-relaxed">
                  {topic.description}
                </p>

                {/* Bottom accent bar */}
                <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

                {/* Action hint */}
                <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 group-hover:text-[var(--text-primary)] transition-colors">
                  <span>Start Practice</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer accent line ── */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
    </div>
  );
}
