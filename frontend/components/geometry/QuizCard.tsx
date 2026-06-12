"use client";
// ─────────────────────────────────────────────
//  QuizCard.tsx
//  Renders a question + geometry diagram.
//  Supports BOTH trigger paths:
//    • diagram field in question JSON (pre-stored)
//    • AI-generated from question text (live)
// ─────────────────────────────────────────────

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useDiagramFromAI } from "./useDiagramFromAI";
import type { GeometryDiagram } from "./diagramSchema";
import { EXAMPLE_DIAGRAM } from "./diagramSchema";

// SSR must be false — Konva uses window
const GeometryRenderer = dynamic(() => import("./GeometryRenderer"), { ssr: false });

// ── Question type (matches your NDJSON schema) ─
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  diagram?: GeometryDiagram;        // pre-stored in question bank
  needs_diagram?: boolean;          // true = ask AI to generate
}

// ── skeleton loader ────────────────────────────
function DiagramSkeleton({ width = 280, height = 220 }: { width?: number; height?: number }) {
  return (
    <div style={{
      width, height,
      background: "rgba(255,255,255,0.04)",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#3d4260",
      fontSize: 12,
      fontFamily: "Inter, sans-serif",
      animation: "pulse 1.5s ease-in-out infinite",
    }}>
      generating diagram…
    </div>
  );
}

// ── diagram zone — handles both paths ─────────
function DiagramZone({ question }: { question: QuizQuestion }) {
  // Path A: diagram pre-stored in NDJSON
  if (question.diagram) {
    return <GeometryRenderer diagram={question.diagram} />;
  }

  // Path B: AI generates from question text
  if (question.needs_diagram) {
    return <AIDiagramZone text={question.question} />;
  }

  return null;
}

function AIDiagramZone({ text }: { text: string }) {
  const { diagram, loading, error } = useDiagramFromAI(text);

  if (loading) return <DiagramSkeleton />;
  if (error)   return (
    <div style={{ fontSize: 11, color: "#f87171", padding: "8px 0" }}>
      Diagram unavailable
    </div>
  );
  if (!diagram) return null;
  return <GeometryRenderer diagram={diagram} />;
}

// ── main QuizCard ──────────────────────────────
interface QuizCardProps {
  question: QuizQuestion;
  onAnswer?: (selected: string, correct: boolean) => void;
  selectedAnswer?: string | null;
  submitted?: boolean;
}

export default function QuizCard({
  question,
  onAnswer,
  selectedAnswer,
  submitted,
}: QuizCardProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const isControlled = selectedAnswer !== undefined;
  const selected = isControlled ? selectedAnswer : internalSelected;
  const answered = submitted ?? selected !== null;

  function handleSelect(opt: string) {
    if (answered) return;
    if (!isControlled) setInternalSelected(opt);
    onAnswer?.(opt, opt === question.answer);
  }

  function optionState(opt: string): "default" | "selected" | "correct" | "wrong" | "reveal" {
    if (!answered) return opt === selected ? "selected" : "default";
    if (opt === question.answer) return "correct";
    if (opt === selected)        return "wrong";
    return "default";
  }

  const optionStyles: Record<string, React.CSSProperties> = {
    default: { borderColor: "#252a3a", color: "#c0c6e0" },
    selected: { borderColor: "#5b9cf6", background: "rgba(91,156,246,0.08)", color: "#8ab4f8" },
    correct: { borderColor: "#34d399", background: "rgba(52,211,153,0.08)", color: "#34d399" },
    wrong:   { borderColor: "#f87171", background: "rgba(248,113,113,0.08)", color: "#f87171" },
    reveal:  { borderColor: "#252a3a", color: "#c0c6e0" },
  };

  return (
    <div style={{
      background: "#171b27",
      border: "1px solid #252a3a",
      borderRadius: 16,
      padding: "20px 20px 22px",
      maxWidth: 420,
      fontFamily: "Inter, Segoe UI, sans-serif",
      color: "#e8eaf0",
    }}>
      {/* question text */}
      <p style={{ fontSize: 14, lineHeight: 1.65, color: "#d0d4e8", margin: "0 0 16px" }}>
        {question.question}
      </p>

      {/* diagram */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <DiagramZone question={question} />
      </div>

      {/* options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options.map((opt, i) => {
          const state = optionState(opt);
          return (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              disabled={answered}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "transparent",
                border: `1.5px solid`,
                borderRadius: 10,
                cursor: answered ? "default" : "pointer",
                textAlign: "left",
                fontSize: 13,
                transition: "all 0.18s",
                ...optionStyles[state],
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: state === "correct" ? "#34d399"
                          : state === "wrong"   ? "#f87171"
                          : state === "selected"? "#5b9cf6"
                          : "#252a3a",
                color: state !== "default" ? "#fff" : "#6b7280",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* explanation */}
      {answered && question.explanation && (
        <div style={{
          marginTop: 14, padding: "10px 14px",
          background: "rgba(91,156,246,0.07)",
          border: "1px solid #1e2f50",
          borderRadius: 10, fontSize: 12, color: "#8ab4f8", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#5b9cf6" }}>Explanation: </strong>
          {question.explanation}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  DEMO — shows both trigger paths side by side
// ─────────────────────────────────────────────
const DEMO_PRESTORED: QuizQuestion = {
  id: "geo-001",
  question: "In triangle ABC, BC = 4.6 cm, AB = 5.2 cm and angle BCA = 90°. What is the length of AC?",
  options: ["2.6 cm", "3.0 cm", "2.0 cm", "3.6 cm"],
  answer: "3.0 cm",
  explanation: "By Pythagoras: AC = √(AB² − BC²) = √(27.04 − 21.16) = √5.88 ≈ 2.42 cm. Closest option is 2.6 cm.",
  diagram: EXAMPLE_DIAGRAM,
};

const DEMO_AI_GENERATED: QuizQuestion = {
  id: "geo-002",
  question: "A ladder of length 10 m leans against a wall. The foot of the ladder is 6 m from the wall. Find the height reached by the ladder.",
  options: ["6 m", "8 m", "7 m", "9 m"],
  answer: "8 m",
  explanation: "Height = √(10² − 6²) = √(100 − 36) = √64 = 8 m.",
  needs_diagram: true,
};

export function QuizCardDemo() {
  return (
    <div style={{
      background: "#0f1117", minHeight: "100vh",
      padding: "32px 16px", display: "flex",
      flexDirection: "column", alignItems: "center", gap: 24,
    }}>
      <h2 style={{
        fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#5b9cf6", margin: 0,
      }}>
        Quiz Card — Geometry Diagrams
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
        <div>
          <p style={{ fontSize: 10, color: "#3d4260", textAlign: "center", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Path A — pre-stored diagram
          </p>
          <QuizCard question={DEMO_PRESTORED} />
        </div>
        <div>
          <p style={{ fontSize: 10, color: "#3d4260", textAlign: "center", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Path B — AI generates diagram
          </p>
          <QuizCard question={DEMO_AI_GENERATED} />
        </div>
      </div>
    </div>
  );
}
