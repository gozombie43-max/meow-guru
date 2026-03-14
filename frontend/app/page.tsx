import Link from "next/link";
import {
  Calculator, Brain, BookOpen, Globe,
  Menu, ArrowRight, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── Subject data ─────────────────────────────────────── */

interface Subject {
  title: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  description: string;
  tags: string[];
  boxTint: string;
  href: string;
}

const subjects: Subject[] = [
  {
    title: "Mathematics",
    icon: Calculator,
    iconBg: "bg-[#d9f2f2]",
    iconColor: "text-[#2ab5b5]",
    description:
      "Master arithmetic, algebra, geometry, and data interpretation with AI-guided practice.",
    tags: ["Algebra", "Geometry", "Arithmetic", "DI"],
    boxTint: "from-[#d6e8f5] to-[#dbeaf6]",
    href: "/mathematics",
  },
  {
    title: "Reasoning",
    icon: Brain,
    iconBg: "bg-[#d9f2f2]",
    iconColor: "text-[#2ab5b5]",
    description:
      "Sharpen logical and analytical reasoning with pattern-based adaptive questions.",
    tags: ["Logical", "Analytical", "Patterns", "Series"],
    boxTint: "from-[#dce6f5] to-[#e3ebf7]",
    href: "/reasoning",
  },
  {
    title: "English",
    icon: BookOpen,
    iconBg: "bg-[#d9f2f2]",
    iconColor: "text-[#2ab5b5]",
    description:
      "Improve grammar, vocabulary, and comprehension with contextual AI exercises.",
    tags: ["Grammar", "Vocabulary", "Comprehension"],
    boxTint: "from-[#d4e9f7] to-[#dbedf9]",
    href: "/english",
  },
  {
    title: "General Awareness",
    icon: Globe,
    iconBg: "bg-[#d9f2f2]",
    iconColor: "text-[#2ab5b5]",
    description:
      "Stay updated with current affairs, history, polity, and science for SSC exams.",
    tags: ["Current Affairs", "History", "Science"],
    boxTint: "from-[#cfe4f0] to-[#d8e9f3]",
    href: "/general-awareness",
  },
];

/* ── Page ──────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-cyan-500" />
            <span className="text-xl font-bold tracking-tight gradient-text font-sans">
              STUDY WITH GURU
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

      {/* ── Hero Section ── */}
      <section className="relative pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h1
            className="animate-fade-in-up text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.08] tracking-tight mb-6 text-[var(--text-primary)]"
            style={{ animationDelay: "150ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
          >
            <span className="gradient-text">STUDY WITH GURU</span>
          </h1>

          <p
            className="animate-fade-in-up developer-credit mb-12"
            style={{ animationDelay: "350ms" }}
          >
            Developed by{" "}
            <span className="gradient-text-subtle font-medium">
              Gurucharan
            </span>
          </p>

          {/* CTA Buttons */}
          <div
            className="animate-fade-in-up flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: "500ms" }}
          >
            <button className="btn-glow px-8 py-3.5 rounded-xl font-semibold flex items-center gap-2 text-base cursor-pointer">
              Start Practicing
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="btn-outline px-8 py-3.5 rounded-xl font-medium text-base cursor-pointer">
              Explore Subjects
            </button>
          </div>
        </div>
      </section>

      {/* ── Subject Boxes ── */}
      <section className="relative pb-24">
        <div className="w-full">
          {/* Section heading */}
          <div className="text-center mb-10 px-6">
            <h2
              className="animate-fade-in-up text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold mb-4 text-[var(--text-primary)]"
              style={{ animationDelay: "600ms", fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
            >
              Choose Your <span className="gradient-text">Subject</span>
            </h2>
            <p
              className="animate-fade-in-up text-slate-500"
              style={{ animationDelay: "650ms" }}
            >
              Select a subject to begin your practice session
            </p>
          </div>

          {/* Full-width subject stack */}
          <div className="flex flex-col gap-[6px]">
            {subjects.map((subject, i) => (
              <article
                key={subject.title}
                className={`w-full bg-gradient-to-r ${subject.boxTint} rounded-[8px] px-5 py-6 animate-fade-in-up transition-[filter] duration-200 hover:brightness-95 active:brightness-95`}
                style={{ animationDelay: `${700 + i * 120}ms` }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${subject.iconBg} flex items-center justify-center mb-4`}
                >
                  <subject.icon
                    className={`w-7 h-7 ${subject.iconColor}`}
                  />
                </div>

                <h3
                  className="text-[28px] font-bold leading-tight tracking-tight text-[#1a2340] mb-3"
                  style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}
                >
                  {subject.title}
                </h3>

                <p className="text-[15px] text-slate-600 leading-6 max-w-3xl mb-3">
                  {subject.description}
                </p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[13px] text-[#555]">
                  {subject.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <Link
                  href={subject.href}
                  className="inline-block text-[14px] font-medium text-[#2ab5b5] transition-colors hover:text-[#209b9b]"
                >
                  Start Practice →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer accent line ── */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
    </div>
  );
}