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
    accentColor: "text-purple-400",
    glowColor: "hover:border-purple-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(167,139,250,0.08)]",
    bgGlow: "bg-purple-500/10",
  },
  {
    title: "Arithmetic",
    emoji: "➕",
    description:
      "Percentage, profit & loss, simple & compound interest, ratio & proportion, time & work.",
    slug: "arithmetic",
    accentColor: "text-orange-400",
    glowColor: "hover:border-orange-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(255,107,53,0.08)]",
    bgGlow: "bg-orange-500/10",
  },
  {
    title: "Algebra",
    emoji: "✖️",
    description:
      "Linear equations, quadratic equations, polynomials, algebraic identities, and simplification.",
    slug: "algebra",
    accentColor: "text-teal-400",
    glowColor: "hover:border-teal-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(0,212,170,0.08)]",
    bgGlow: "bg-teal-500/10",
  },
  {
    title: "Geometry",
    emoji: "📐",
    description:
      "Lines, angles, triangles, circles, quadrilaterals, and coordinate geometry fundamentals.",
    slug: "geometry",
    accentColor: "text-amber-400",
    glowColor: "hover:border-amber-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(251,191,36,0.08)]",
    bgGlow: "bg-amber-500/10",
  },
  {
    title: "Mensuration",
    emoji: "📏",
    description:
      "Area, perimeter, surface area, and volume of 2D and 3D shapes for competitive exams.",
    slug: "mensuration",
    accentColor: "text-pink-400",
    glowColor: "hover:border-pink-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(236,72,153,0.08)]",
    bgGlow: "bg-pink-500/10",
  },
  {
    title: "Trigonometry",
    emoji: "📊",
    description:
      "Trigonometric ratios, identities, heights & distances, and angle-based problem solving.",
    slug: "trigonometry",
    accentColor: "text-blue-400",
    glowColor: "hover:border-blue-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(96,165,250,0.08)]",
    bgGlow: "bg-blue-500/10",
  },
  {
    title: "Statistics & Probability",
    emoji: "📈",
    description:
      "Mean, median, mode, data interpretation, and probability concepts for SSC examinations.",
    slug: "statistics-probability",
    accentColor: "text-emerald-400",
    glowColor: "hover:border-emerald-500/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(52,211,153,0.08)]",
    bgGlow: "bg-emerald-500/10",
  },
];

/* ── Page ──────────────────────────────────────────────── */

export default function MathematicsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">

      {/* ── Background Effects ── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-[15%] -left-[10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] animate-float" />
        <div className="absolute top-[50%] -right-[10%] w-[450px] h-[450px] rounded-full bg-orange-500/8 blur-[100px] animate-float-reverse" />
        <div
          className="absolute -bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full bg-amber-500/6 blur-[80px] animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold tracking-tight gradient-text">
              SSC AI
            </span>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </nav>

      {/* ── Page Header ── */}
      <section className="relative pt-28 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Back button */}
          <Link
            href="/"
            className="animate-fade-in-up inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-10 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Subjects</span>
          </Link>

          {/* Page heading */}
          <div className="flex items-center gap-4 mb-3">
            <div
              className="animate-fade-in-up w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center"
              style={{ animationDelay: "100ms" }}
            >
              <span className="text-2xl">🧮</span>
            </div>
            <h1
              className="animate-fade-in-up text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-tight"
              style={{ animationDelay: "150ms" }}
            >
              <span className="gradient-text">Mathematics</span> Topics
            </h1>
          </div>
          <p
            className="animate-fade-in-up text-gray-400 text-[clamp(0.95rem,1.8vw,1.1rem)] max-w-2xl leading-relaxed"
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
                    className={`w-4 h-4 text-gray-600 ${topic.accentColor.replace("text-", "group-hover:text-")} transition-all group-hover:translate-x-1`}
                  />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold mb-2 tracking-tight">
                  {topic.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed">
                  {topic.description}
                </p>

                {/* Bottom accent bar */}
                <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                {/* Action hint */}
                <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                  <span>Start Practice</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer accent line ── */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
    </div>
  );
}
