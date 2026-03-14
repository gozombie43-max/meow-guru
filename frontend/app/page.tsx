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
  chips: string[];
  cardGlow: string;
  hoverText: string;
  href: string;
}

const subjects: Subject[] = [
  {
    title: "Mathematics",
    icon: Calculator,
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-500",
    description:
      "Master arithmetic, algebra, geometry, and data interpretation with AI-guided practice.",
    chips: ["Algebra", "Geometry", "Arithmetic", "DI"],
    cardGlow: "card-purple",
    hoverText: "group-hover:text-cyan-400",
    href: "/mathematics",
  },
  {
    title: "Reasoning",
    icon: Brain,
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-500",
    description:
      "Sharpen logical and analytical reasoning with pattern-based adaptive questions.",
    chips: ["Logical", "Analytical", "Patterns", "Series"],
    cardGlow: "card-orange",
    hoverText: "group-hover:text-teal-400",
    href: "/reasoning",
  },
  {
    title: "English",
    icon: BookOpen,
    iconBg: "bg-indigo-400/10",
    iconColor: "text-indigo-400",
    description:
      "Improve grammar, vocabulary, and comprehension with contextual AI exercises.",
    chips: ["Grammar", "Vocabulary", "Comprehension"],
    cardGlow: "card-teal",
    hoverText: "group-hover:text-indigo-400",
    href: "/english",
  },
  {
    title: "General Awareness",
    icon: Globe,
    iconBg: "bg-sky-400/10",
    iconColor: "text-sky-400",
    description:
      "Stay updated with current affairs, history, polity, and science for SSC exams.",
    chips: ["Current Affairs", "History", "Science"],
    cardGlow: "card-gold",
    hoverText: "group-hover:text-sky-400",
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

      {/* ── Subject Cards ── */}
      <section className="relative px-6 pb-32">
        <div className="max-w-6xl mx-auto">
          {/* Section heading */}
          <div className="text-center mb-16">
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

          {/* Card grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {subjects.map((subject, i) => (
              <Link
                key={subject.title}
                href={subject.href}
                className={`glass-card ${subject.cardGlow} rounded-2xl p-4 cursor-pointer group animate-fade-in-up block`}
                style={{ animationDelay: `${700 + i * 120}ms` }}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl ${subject.iconBg} flex items-center justify-center mb-3`}
                >
                  <subject.icon
                    className={`w-5 h-5 ${subject.iconColor}`}
                  />
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold mb-1.5 tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
                  {subject.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  {subject.description}
                </p>

                {/* Topic chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {subject.chips.map((chip) => (
                    <span
                      key={chip}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-slate-500 border border-white/30"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                {/* Action link */}
                <div
                  className={`flex items-center gap-1 text-xs text-slate-500 ${subject.hoverText} transition-colors`}
                >
                  <span>Start Practice</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
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