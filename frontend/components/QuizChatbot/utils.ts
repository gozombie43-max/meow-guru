"use client";

import { API_BASE } from "@/lib/api-base";
export { normalizeTutorMarkdown } from "@/app/(app)/ai-chat/formatting";

export const API = API_BASE;

export type ChatMessage = {
  role: "bot" | "user";
  content: string;
  isError?: boolean;
  retryText?: string;
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
  activeLang?: "en" | "hi" | "bn" | string;
  renderTrigger?: (onClick: () => void) => React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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


