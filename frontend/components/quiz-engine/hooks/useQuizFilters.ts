import type { SubjectConfig } from "@/components/quiz-engine/types";
import {
  ClassificationGroup,
} from "@/components/quiz-engine/types";
import {
  buildConceptColours,
  ensureUniqueQuestionIds,
  isStudyModeQuestion,
  toQuizQuestion,
} from "@/components/quiz-engine/utils";
import { useQuestionsMeta } from "@/hooks/useQuestionsMeta";
import { useQuizSession } from "@/hooks/useQuizSession";
import {
  normalizeExamLabel,
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

  const { meta } = useQuestionsMeta({
    subject: subjectConfig.subjectId,
    topic: questionTopic ?? slug,
    mode,
  });

  const selectedRawExams = useMemo(() => {
    if (!examFilter || examFilter === "all") return undefined;
    const rawExams = meta?.exams ?? [];
    const matches = rawExams.filter((e) => normalizeExamLabel((e ?? "").trim()) === examFilter);
    if (matches.length === 0) return examFilter; // Fallback to raw filter if no matches
    return matches.join(",");
  }, [examFilter, meta?.exams]);

  const {
    questions: apiQuestions,
    hasMore,
    isFetchingMore,
    fetchMore,
    totalCount: apiTotalCount,
    isLoading,
  } = useQuizSession({
    subject: subjectConfig.subjectId,
    topic: questionTopic ?? slug,
    mode,
    limit: 100,
    exam: selectedRawExams,
    concept:
      selectedClassificationConcepts.size > 0
        ? Array.from(selectedClassificationConcepts).join(",")
        : undefined,
    letter: selectedLetters.size > 0 ? Array.from(selectedLetters).join(",") : undefined,
  });

  const baseConcepts = useMemo(
    () => subjectConfig.topicConcepts[slug] ?? [],
    [slug, subjectConfig.topicConcepts],
  );

  const conceptOptions = useMemo(() => {
    const set = new Set<string>();
    baseConcepts.forEach((concept) => set.add(concept));
    (meta?.concepts ?? []).forEach((concept) => {
      if (concept) set.add(concept);
    });
    const list = Array.from(set);
    return list.length > 0 ? list : ["General"];
  }, [baseConcepts, meta]);

  const conceptColours = useMemo(
    () => buildConceptColours(conceptOptions),
    [conceptOptions],
  );

  const examOptions = useMemo(() => {
    const set = new Set<string>();
    (meta?.exams ?? []).forEach((e) => {
      const exam = normalizeExamLabel((e ?? "").trim());
      if (exam) set.add(exam);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [meta]);

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

  const availableLetters = useMemo(() => {
    return Object.keys(meta?.letters ?? {}).sort();
  }, [meta]);

  const letterCounts = useMemo(() => {
    return meta?.letters ?? {};
  }, [meta]);

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

  const questions = useMemo(() => {
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

  const hasActiveFilters =
    (examFilter && examFilter !== "all") ||
    selectedClassificationConcepts.size > 0 ||
    selectedLetters.size > 0;

  const availableCount = hasActiveFilters ? (apiTotalCount ?? 0) : (apiTotalCount || (meta?.total ?? 0));

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
    isLoading,
  };
}
