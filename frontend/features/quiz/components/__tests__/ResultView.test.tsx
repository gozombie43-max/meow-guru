import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultView, type ResultViewProps } from "../views/ResultView";
import { MODE_LABELS } from "../../model/utils";

afterEach(cleanup);

const baseProps: ResultViewProps = {
  subjectConfig: {
    subjectId: "reasoning",
    subjectLabel: "Reasoning",
    cssClassName: "reasoning-quiz",
    topicConcepts: {},
    classificationCategories: [],
    getClassificationCategoryId: () => "",
  },
  title: "Analogy",
  theme: "dark",
  toggleTheme: vi.fn(),
  themeStyles: <style />,
  modeLabels: MODE_LABELS,
  mode: "concept",
  stats: {
    correct: 3,
    wrong: 1,
    accuracy: 75,
    avgTime: 12,
  },
  bestStreak: 3,
  results: [
    {
      questionId: 1,
      questionIndex: 0,
      selected: 1,
      correct: 1,
      isCorrect: true,
      timeTaken: 10,
      concept: "Number Analogy",
      difficulty: "easy",
    },
    {
      questionId: 2,
      questionIndex: 1,
      selected: 2,
      correct: 0,
      isCorrect: false,
      timeTaken: 14,
      concept: "Word Analogy",
      difficulty: "medium",
    },
  ],
  questions: Array.from({ length: 37 }, (_, id) => ({
    id,
    concept: "Number Analogy",
    formula: "",
    question: `Q${id + 1}`,
    options: ["A", "B", "C", "D"],
    correctAnswer: 0,
    answer: "A",
    difficulty: "easy" as const,
    estimatedTime: 30,
    year: "2024",
    exam: "SSC CGL",
    solution: "",
  })),
  availableCount: 37,
  conceptOptions: [],
  conceptColours: {},
  weakConcepts: [{ concept: "Word Analogy", accuracy: 0 }],
  handleRestart: vi.fn(),
  showQuestion: vi.fn(),
  routeBase: "/reasoning/analogy",
  slug: "analogy",
};

describe("ResultView", () => {
  it("renders redesigned hero, metrics, concept breakdown from results, weak areas, and actions", () => {
    render(<ResultView {...baseProps} />);

    expect(
      screen.getByRole("heading", { name: /Session Complete/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Analogy")).toBeInTheDocument();
    expect(screen.getByText("Excellent Mastery")).toBeInTheDocument();

    // Concept breakdown populates from actual results even when conceptOptions is empty
    expect(screen.getByText("Concept Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Number Analogy")).toBeInTheDocument();
    expect(screen.getByText("1/1 correct")).toBeInTheDocument();

    // Weak areas
    expect(screen.getByText("Weak Areas - Needs Practice")).toBeInTheDocument();
    expect(screen.getByText("0% accuracy")).toBeInTheDocument();

    // Question review map allows jumping back to a question
    const q1Button = screen.getByRole("button", {
      name: /Review question 1, correct, 10 seconds/i,
    });
    fireEvent.click(q1Button);
    expect(baseProps.showQuestion).toHaveBeenCalledWith(0);

    // Practice Again action
    fireEvent.click(screen.getByRole("button", { name: /Practice Again/i }));
    expect(baseProps.handleRestart).toHaveBeenCalled();
  });
});
