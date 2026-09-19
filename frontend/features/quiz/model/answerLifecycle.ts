import type { Difficulty,QuizQuestion,SessionResult } from "@/features/quiz/model/types";

export function nextDifficulty(results: SessionResult[], difficulty: Difficulty, correct: boolean): Difficulty {
  const recentCorrect = [...results.slice(-4), { isCorrect: correct }].filter(result => result.isCorrect).length;
  if (recentCorrect >= 4 && difficulty !== "hard") return difficulty === "easy" ? "medium" : "hard";
  if (recentCorrect <= 1 && difficulty !== "easy") return difficulty === "hard" ? "medium" : "easy";
  return difficulty;
}

export function recordAnswer(results: SessionResult[], question: QuizQuestion, index: number, selected: number, timeTaken: number): SessionResult[] {
  const result: SessionResult = { questionId: question.id, questionIndex: index, selected,
    correct: question.correctAnswer, isCorrect: selected === question.correctAnswer,
    timeTaken, concept: question.concept, difficulty: question.difficulty };
  const existing = results.findIndex(entry => entry.questionIndex === index);
  if (existing < 0) return [...results, result];
  return results.map((entry, position) => position === existing ? result : entry);
}
