import type { SubjectConfig } from "@/components/quiz-engine/types";
import {
  ClassificationGroup,
  QuizQuestionRecord,
} from "@/components/quiz-engine/types";
import {
  buildConceptColours,
  ensureUniqueQuestionIds,
  isAiChallengeQuestion,
  isFormulaQuestion,
  isMixedQuestion,
  isStudyModeQuestion,
  isTier2Question,
  isTopicMixQuestion,
  toQuizQuestion,
} from "@/components/quiz-engine/utils";
import { useQuestionsMeta } from "@/hooks/useQuestionsMeta";
import { useQuizSession } from "@/hooks/useQuizSession";
import {
  buildQuizIndex,
  normalizeExamLabel,
  resolveIndexedQuestions,
} from "@/lib/quiz-index";
import { useCallback, useMemo, useState } from "react";
import type { QuizMode } from "../types";
export function useQuizFilters({
  subjectConfig,
  slug,
  questionTopic,
  mode,
  initialLetterParam,
}: {
  subjectConfig: SubjectConfig;
  slug: string;
  questionTopic?: string;
  mode: QuizMode;
  initialLetterParam: string | null;
}) {
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [selectedClassificationConcepts, setSelectedClassificationConcepts] =
    useState<Set<string>>(() => new Set());
  const [examFilter, setExamFilter] = useState<string>("");
  const [classificationSearch, setClassificationSearch] = useState("");
  const [classificationCategory, setClassificationCategory] = useState<
    "All" | string
  >("All");
  const baseConcepts = useMemo(
    () => subjectConfig.topicConcepts[slug] ?? [],
    [slug, subjectConfig.topicConcepts],
  );
  const {
    questions: apiQuestions,
    hasMore,
    isFetchingMore,
    fetchMore,
  } = useQuizSession({
    subject: subjectConfig.subjectId,
    topic: questionTopic ?? slug,
    mode,
    limit: 5000,
  });
  const { meta } = useQuestionsMeta({
    subject: subjectConfig.subjectId,
    topic: questionTopic ?? slug,
  });
  const allQuestions = useMemo(() => {
    if (!apiQuestions) return [];
    const fallbackConcept = baseConcepts[0] ?? "General";
    const quizOnlyQuestions = apiQuestions.filter(
      (item) => !isStudyModeQuestion(item),
    );
    return ensureUniqueQuestionIds(
      quizOnlyQuestions.map((item, index) =>
        toQuizQuestion(item, index, fallbackConcept),
      ),
    );
  }, [apiQuestions, baseConcepts]);

  const conceptOptions = useMemo(() => {
    const set = new Set<string>();
    baseConcepts.forEach((concept) => set.add(concept));
    (meta?.concepts ?? []).forEach((concept) => {
      if (concept) set.add(concept);
    });
    allQuestions.forEach((question) => {
      if (question.concept) set.add(question.concept);
    });
    const list = Array.from(set);
    return list.length > 0 ? list : ["General"];
  }, [allQuestions, baseConcepts, meta]);

  const conceptColours = useMemo(
    () => buildConceptColours(conceptOptions),
    [conceptOptions],
  );

  const questionIndex = useMemo(
    () =>
      buildQuizIndex(allQuestions, {
        getBucket: (question) => {
          if (isFormulaQuestion(question)) return "formula";
          if (isAiChallengeQuestion(question)) return "ai-challenge";
          if (isTier2Question(question)) return "hard";
          if (isTopicMixQuestion(question)) return "easy";
          if (isMixedQuestion(question)) return "mixed";
          return "concept";
        },
        getConcept: (question) => question.concept,
        getExam: (question) => question.exam,
        // Preserve cursor order so appending a page cannot move answered questions.
      }),
    [allQuestions],
  );

  const examOptions = useMemo(() => {
    const set = new Set<string>();
    (meta?.exams ?? []).forEach((e) => {
      const exam = normalizeExamLabel((e ?? "").trim());
      if (exam) set.add(exam);
    });
    allQuestions.forEach((q) => {
      const exam = normalizeExamLabel((q.exam ?? "").trim());
      if (exam) set.add(exam);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allQuestions, meta]);

  const classificationGroups = useMemo<ClassificationGroup[]>(() => {
    const search = classificationSearch.trim().toLowerCase();
    const grouped = subjectConfig.classificationCategories
      .map((category) => ({
        ...category,
        concepts: conceptOptions.filter((concept) => {
          if (
            subjectConfig.getClassificationCategoryId(concept) !== category.id
          )
            return false;
          if (
            classificationCategory !== "All" &&
            classificationCategory !== category.label
          ) {
            return false;
          }
          return !search || concept.toLowerCase().includes(search);
        }),
      }))
      .filter((category) => category.concepts.length > 0);

    return grouped;
  }, [
    classificationCategory,
    classificationSearch,
    conceptOptions,
    subjectConfig,
  ]);

  const isClassificationConceptMode = mode === "concept";
  const isEnglishSynonymsFormula =
    subjectConfig.subjectId === "english" &&
    slug === "synonyms-antonyms" &&
    mode === "formula";

  const [selectedLetters, setSelectedLetters] = useState<Set<string>>(() => {
    if (initialLetterParam) {
      const letters = initialLetterParam
        .split(",")
        .map((l) => l.trim().toUpperCase())
        .filter((l) => /^[A-Z]$/.test(l));
      if (letters.length > 0) return new Set(letters);
    }
    return new Set();
  });

  const { availableLetters, letterCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const lettersSet = new Set<string>();
    const normalizedExam = normalizeExamLabel(examFilter);

    allQuestions.forEach((q) => {
      if (isFormulaQuestion(q)) {
        if (normalizedExam && normalizeExamLabel(q.exam ?? "") !== normalizedExam) {
          return;
        }
        const letter = (q.letter || (q.word ? q.word.trim().charAt(0) : ""))
          .trim()
          .toUpperCase();
        if (letter && /^[A-Z]$/.test(letter)) {
          lettersSet.add(letter);
          counts[letter] = (counts[letter] ?? 0) + 1;
        }
      }
    });

    return {
      availableLetters: Array.from(lettersSet).sort(),
      letterCounts: counts,
    };
  }, [allQuestions, examFilter]);

  const handleToggleLetter = useCallback((letter: string) => {
    const upper = letter.trim().toUpperCase();
    setSelectedLetters((prev) => {
      if (prev.has(upper) && prev.size === 1) {
        return new Set();
      }
      return new Set([upper]);
    });
  }, []);

  const handleSelectAllLetters = useCallback(() => {
    setSelectedLetters(new Set());
  }, []);

  const classificationCategoryCounts = useMemo(
    () =>
      Object.fromEntries(
        subjectConfig.classificationCategories.map((category) => [
          category.label,
          conceptOptions.filter(
            (concept) =>
              subjectConfig.getClassificationCategoryId(concept) ===
              category.id,
          ).length,
        ]),
      ),
    [conceptOptions, subjectConfig],
  );

  const filteredQuestions = useMemo(() => {
    const resolved = resolveIndexedQuestions(questionIndex, {
      bucket: mode,
      concept: "all",
      exam: examFilter,
    });
    const selected = selectedClassificationConcepts;
    let baseQuestions: QuizQuestionRecord[] =
      selected.size === 0
        ? resolved
        : resolved.filter((question) => selected.has(question.concept));

    if (isEnglishSynonymsFormula && selectedLetters.size > 0) {
      baseQuestions = baseQuestions.filter((question) => {
        const qLetter = (
          question.letter ||
          (question.word ? question.word.trim().charAt(0) : "")
        )
          .trim()
          .toUpperCase();
        return selectedLetters.has(qLetter);
      });
    }

    return baseQuestions;
  }, [
    questionIndex,
    mode,
    examFilter,
    selectedClassificationConcepts,
    isEnglishSynonymsFormula,
    selectedLetters,
  ]);

  const questions = filteredQuestions;
  const availableCount = filteredQuestions.length;

  return {
    conceptFilter,
    setConceptFilter,
    selectedClassificationConcepts,
    setSelectedClassificationConcepts,
    examFilter,
    setExamFilter,
    classificationSearch,
    setClassificationSearch,
    classificationCategory,
    setClassificationCategory,
    hasMore,
    isFetchingMore,
    fetchMore,
    conceptOptions,
    conceptColours,
    questionIndex,
    examOptions,
    classificationGroups,
    isClassificationConceptMode,
    selectedLetters,
    availableLetters,
    letterCounts,
    handleToggleLetter,
    handleSelectAllLetters,
    classificationCategoryCounts,
    questions,
    availableCount,
  };
}
