"use client";

import { API_BASE } from "@/lib/api-base";

export const API = API_BASE;

export type ChatMessage = {
  role: "bot" | "user";
  content: string;
};

export interface QuizChatbotQuestion {
  id?: number | string;
  question: string;
  options?: string[];
  correctAnswer?: number;
  answer?: string;
  solution?: string;
  concept?: string;
  exam?: string;
}

export interface QuizChatbotProps {
  isVisible: boolean;
  questionNumber: number;
  topicTitle: string;
  question?: QuizChatbotQuestion;
  theme?: string;
  renderTrigger?: (onClick: () => void) => React.ReactNode;
}

export function resolveCorrectAnswer(question?: QuizChatbotQuestion) {
  if (!question) return "";
  if (question.answer) return question.answer;
  if (
    typeof question.correctAnswer === "number" &&
    question.options?.[question.correctAnswer]
  ) {
    return question.options[question.correctAnswer];
  }
  return "";
}

export function buildQuestionContext(
  questionNumber: number,
  topicTitle: string,
  question?: QuizChatbotQuestion
) {
  if (!question) return "";

  const options = question.options?.length
    ? question.options
        .map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`)
        .join("\n")
    : "No options provided.";

  return [
    `Question ${questionNumber}`,
    `Topic: ${topicTitle}`,
    question.concept ? `Concept: ${question.concept}` : "",
    question.exam ? `Exam: ${question.exam}` : "",
    "",
    `Question:\n${question.question}`,
    "",
    `Options:\n${options}`,
    "",
    `Correct answer: ${resolveCorrectAnswer(question) || "Not provided"}`,
    question.solution ? `\nSolution:\n${question.solution}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeTutorMarkdown(content: string) {
  const latexCommand =
    /\\(?:frac|dfrac|tfrac|sin|cos|tan|cot|sec|csc|theta|times|div|sqrt|text|Rightarrow|left|right|pi|alpha|beta|gamma|cdot|le|ge|neq|approx|therefore|because|degree|overline|angle|triangle|parallel|perp|infty|sum|prod|log|ln)/;
  const practiceHeadingPattern = /^(?:#{1,6}\s*)?(?:\*\*)?Practice Questions?(?:\*\*)?:?\s*$/i;
  const practicePromptPattern =
    /^(?:solve|find|determine|factorise|factorize|compute|simplify|evaluate|show|prove|add|subtract|calculate|compare|derive)\b/i;

  const cleanLatex = (value: string) =>
    value
      .replace(/\$+\s+\$+/g, " ")
      .replace(/^\$+|\$+$/g, "")
      .replace(/\$/g, "")
      .replace(/\\operatorname\{([^}]+)\}/g, "\\text{$1}")
      .replace(/\s+/g, " ")
      .trim();

  const isMathLikeLine = (line: string) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("$$") || trimmed.startsWith("$") || trimmed.startsWith("\\")) return true;
    if (/\\[a-zA-Z]+/.test(trimmed)) return true;
    if (/[=<>]/.test(trimmed)) return true;
    return /^[\d\s()[\]{}.+\-*/^,:]+$/.test(trimmed);
  };

  const isPracticePromptLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (
      /^#{1,6}\s+/.test(trimmed) ||
      /^(\*\*.*\*\*|>|\d+[.)]|\s*[-*+•])\s*/.test(trimmed) ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("$$") ||
      trimmed.startsWith("$") ||
      trimmed.startsWith("\\")
    ) {
      return false;
    }

    return trimmed.endsWith(":") || practicePromptPattern.test(trimmed);
  };

  const normalizeMathLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("```")) return line;
    if (trimmed.startsWith("$$")) return line;
    if (!latexCommand.test(line)) return line;

    const listPrefixMatch = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    const prefix = listPrefixMatch?.[1] ?? "";
    const body = listPrefixMatch?.[2] ?? line;
    const bodyTrimmed = body.trim();
    const proseProbe = bodyTrimmed
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/[0-9_{}^=+\-*/().,:%\s]/g, "");

    const isRawEquation =
      bodyTrimmed.startsWith("\\") ||
      (/=/.test(bodyTrimmed) && proseProbe.length <= 2);

    if (!isRawEquation) return line;

    const math = cleanLatex(bodyTrimmed);

    return `${prefix}$$${math}$$`;
  };

  return content
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$+\s+\$+/g, " ")
    .replace(/\$\s*\\displaystyle\s+/g, "$")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$([^$\n]*\\[a-zA-Z][^$\n]*)\$/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(
      /\*\*((?=[^*\n]*\\(?:frac|sin|cos|tan|theta))[^*\n]+)\*\*/g,
      (_, math: string) => `**$${cleanLatex(math)}$**`
    )
    .replace(
      /^\s*\[\s*((?=.*\\[a-zA-Z]+)[^\]\n]+)\s*\]\s*$/gm,
      (_, math: string) => `$$${cleanLatex(math)}$$`
    )
    .split("\n")
    .map(normalizeMathLine)
    .reduce<{ lines: string[]; inPractice: boolean; inPracticeItem: boolean }>(
      (state, line) => {
        const trimmed = line.trim();

        if (practiceHeadingPattern.test(trimmed)) {
          state.inPractice = true;
          state.inPracticeItem = false;
          state.lines.push(line);
          return state;
        }

        if (state.inPractice && /^#{1,6}\s+/.test(trimmed) && !practiceHeadingPattern.test(trimmed)) {
          state.inPractice = false;
          state.inPracticeItem = false;
        }

        if (state.inPractice && /^(\*\*Answer:\*\*|Answer:)/i.test(trimmed)) {
          state.inPractice = false;
          state.inPracticeItem = false;
        }

        if (
          state.inPractice &&
          trimmed &&
          !/^(\d+[.)]|\s*[-*+•])\s+/.test(trimmed) &&
          isPracticePromptLine(line)
        ) {
          state.lines.push(`- ${trimmed}`);
          state.inPracticeItem = true;
          return state;
        }

        if (state.inPractice && state.inPracticeItem && trimmed && isMathLikeLine(trimmed)) {
          state.lines.push(`  ${trimmed}`);
          return state;
        }

        if (state.inPractice && !trimmed) {
          state.lines.push(line);
          return state;
        }

        if (state.inPractice && trimmed && /^(\d+[.)]|\s*[-*+•])\s+/.test(trimmed)) {
          state.inPracticeItem = true;
        }

        state.lines.push(line);
        return state;
      },
      { lines: [], inPractice: false, inPracticeItem: false }
    ).lines.join("\n");
}

