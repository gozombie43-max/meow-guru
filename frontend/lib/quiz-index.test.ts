import { describe, expect, it } from "vitest";
import { buildQuizIndex, normalizeExamLabel, resolveIndexedQuestions } from "./quiz-index";

type Question = {
  id: number;
  bucket: string;
  concept: string;
  exam: string;
};

const questions: Question[] = [
  { id: 3, bucket: "concept", concept: "Algebra", exam: "SSC CGL 2024 Shift 2" },
  { id: 1, bucket: "concept", concept: "Geometry", exam: "SSC CHSL 2023 Morning" },
  { id: 2, bucket: "formula", concept: "Algebra", exam: "SSC CGL Tier II 2022" },
  { id: 4, bucket: "concept", concept: "Algebra", exam: "SSC CGL 2023 Shift 1" },
];

const makeIndex = () =>
  buildQuizIndex(questions, {
    getBucket: (question) => question.bucket,
    getConcept: (question) => question.concept,
    getExam: (question) => question.exam,
    compare: (a, b) => a.id - b.id,
  });

describe("normalizeExamLabel", () => {
  it.each([
    ["SSC CGL 2024 Shift 2", "SSC CGL"],
    ["SSC CGL Tier II 2022", "SSC CGL Tier II"],
    ["SSC CHSL 2023 Morning", "SSC CHSL"],
    ["Railway Set 12", "Railway"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeExamLabel(input)).toBe(expected);
  });
});

describe("quiz index", () => {
  it("does not mutate the source array while sorting indexed results", () => {
    const sourceOrder = questions.map((question) => question.id);

    const index = makeIndex();

    expect(questions.map((question) => question.id)).toEqual(sourceOrder);
    expect(resolveIndexedQuestions(index, { bucket: "concept" }).map((question) => question.id)).toEqual([
      1, 3, 4,
    ]);
  });

  it("filters by concept and normalized exam", () => {
    const result = resolveIndexedQuestions(makeIndex(), {
      bucket: "concept",
      concept: "Algebra",
      exam: "SSC CGL",
    });

    expect(result.map((question) => question.id)).toEqual([3, 4]);
  });

  it("returns an empty collection for an unknown bucket", () => {
    expect(resolveIndexedQuestions(makeIndex(), { bucket: "missing" })).toEqual([]);
  });
});
