import Link from "next/link";
import {
  Calculator, Brain, BookOpen, Globe,
  Menu, ArrowRight, Sparkles, Zap,
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
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-400",
    description:
      "Master arithmetic, algebra, geometry, and data interpretation with AI-guided practice.",
    chips: ["Algebra", "Geometry", "Arithmetic", "DI"],
    cardGlow: "card-purple",
    hoverText: "group-hover:text-purple-400",
    href: "/mathematics",
  },
  {
    title: "Reasoning",
    icon: Brain,
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-400",
    description:
      "Sharpen logical and analytical reasoning with pattern-based adaptive questions.",
    chips: ["Logical", "Analytical", "Patterns", "Series"],
    cardGlow: "card-orange",
    hoverText: "group-hover:text-orange-400",
    href: "/reasoning",
  },
  {
    title: "English",
    icon: BookOpen,
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-400",
    description:
      "Improve grammar, vocabulary, and comprehension with contextual AI exercises.",
    chips: ["Grammar", "Vocabulary", "Comprehension"],
    cardGlow: "card-teal",
    hoverText: "group-hover:text-teal-400",
    href: "/english",
  },
  {
    title: "General Awareness",
    icon: Globe,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    description:
      "Stay updated with current affairs, history, polity, and science for SSC exams.",
    chips: ["Current Affairs", "History", "Science"],
    cardGlow: "card-gold",
    hoverText: "group-hover:text-amber-400",
    href: "/general-awareness",
  },
];

/* ── Page ──────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">

      {/* ── Background Effects ── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px] animate-float" />
        <div
          className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] rounded-full bg-orange-500/8 blur-[100px] animate-float-reverse"
        />
        <div
          className="absolute -bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-amber-500/6 blur-[80px] animate-float"
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

      {/* ── Hero Section ── */}
      <section className="relative pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div
            className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300 tracking-wide">
              AI-Powered Learning Platform
            </span>
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-in-up text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.08] tracking-tight mb-6"
            style={{ animationDelay: "150ms" }}
          >
            Master SSC Exams
            <br />
            <span className="gradient-text">with AI Intelligence</span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-in-up text-[clamp(1rem,2vw,1.2rem)] text-gray-400 max-w-2xl mx-auto mb-3 leading-relaxed"
            style={{ animationDelay: "300ms" }}
          >
            Practice smarter with adaptive AI that analyzes your strengths,
            identifies weak areas, and creates personalized study paths for SSC
            success.
          </p>
          <p
            className="animate-fade-in-up text-sm text-gray-500 mb-12"
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
            <button className="btn-glow px-8 py-3.5 rounded-xl text-white font-semibold flex items-center gap-2 text-base cursor-pointer">
              Start Practicing
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="btn-outline px-8 py-3.5 rounded-xl text-gray-300 font-medium text-base cursor-pointer">
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
              className="animate-fade-in-up text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold mb-4"
              style={{ animationDelay: "600ms" }}
            >
              Choose Your <span className="gradient-text">Subject</span>
            </h2>
            <p
              className="animate-fade-in-up text-gray-400"
              style={{ animationDelay: "650ms" }}
            >
              Select a subject to begin your practice session
            </p>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {subjects.map((subject, i) => (
              <Link
                key={subject.title}
                href={subject.href}
                className={`glass-card ${subject.cardGlow} rounded-2xl p-6 cursor-pointer group animate-fade-in-up block`}
                style={{ animationDelay: `${700 + i * 120}ms` }}
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl ${subject.iconBg} flex items-center justify-center mb-5`}
                >
                  <subject.icon
                    className={`w-6 h-6 ${subject.iconColor}`}
                  />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold mb-2 tracking-tight">
                  {subject.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  {subject.description}
                </p>

                {/* Topic chips */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {subject.chips.map((chip) => (
                    <span
                      key={chip}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] text-gray-500 border border-white/[0.06]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                {/* Action link */}
                <div
                  className={`flex items-center gap-1.5 text-sm text-gray-500 ${subject.hoverText} transition-colors`}
                >
                  <span>Start Practice</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
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