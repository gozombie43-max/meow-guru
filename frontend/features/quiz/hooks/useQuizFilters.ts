import { useAuth } from '@/context/AuthContext';
import type { SubjectConfig } from "@/features/quiz/model/types";
import {
  ClassificationGroup,
} from "@/features/quiz/model/types";
import {
  buildConceptColours,
  ensureUniqueQuestionIds,
  isStudyModeQuestion,
  toQuizQuestion,
} from "@/features/quiz/model/utils";
import { useQuestionsMeta } from "@/hooks/useQuestionsMeta";
import { useQuizSession } from "@/hooks/useQuizSession";
import {
  normalizeExamLabel,
} from "@/lib/quiz-index";
import { useCallback, useMemo, useState } from "react";
import type { QuizMode } from "@/features/quiz/model/types";
export function useQuizFilters({
  subjectConfig,
  slug,
  questionTopic,
  mode,
  initialLetterParam,
  resumeRequested = false,
}: {
  subjectConfig: SubjectConfig;
  slug: string;
  questionTopic?: string;
  mode: QuizMode;
  initialLetterParam: string | null;
  resumeRequested?: boolean;
}) {
  const { user, loading: authLoading } = useAuth();
  const [resumeEntry, setResumeEntry] = useState(() => resumeRequested
    ? user?.recentQuizzes?.find(entry => entry.quizKey === `${subjectConfig.subjectId}:${slug}` && entry.status !== 'completed') : undefined);
  const [resumeWindow, setResumeWindow] = useState<{ index?: number; anchor?: string; filters?: { exam?: string; concept?: string; letter?: string } }>(() => ({ index: resumeEntry?.currentIndex, anchor: resumeEntry?.questionAnchor }));
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [selectedClassificationConcepts, setSelectedClassificationConcepts] =
    useState<Set<string>>(() => new Set(resumeEntry?.sessionFilters?.concept?.split(',').filter(Boolean) ?? []));
  const [examFilter, setExamFilter] = useState<string>(resumeEntry?.sessionFilters?.exam ?? '');
  const [classificationSearch, setClassificationSearch] = useState("");
  const [classificationCategory, setClassificationCategory] = useState<
    "All" | string
  >("All");

  const [selectedLetters, setSelectedLetters] = useState<Set<string>>(() => {
    const letterParam = resumeEntry?.sessionFilters?.letter ?? initialLetterParam;
    if (letterParam) {
      const letters = letterParam
        .split(",")
        .map((l) => l.trim().toUpperCase())
        .filter((l) => /^[A-Z]$/.test(l));
      if (letters.length > 0) return new Set(letters);
    }
    return new Set();
  });
  const restoredEntry = resumeRequested ? user?.recentQuizzes?.find(entry => entry.quizKey === `${subjectConfig.subjectId}:${slug}` && entry.status !== 'completed') : undefined;
  if (!resumeEntry && restoredEntry) {
    // Auth restoration preserves this component. Initialize before enabling its first session query.
    setResumeEntry(restoredEntry);
    setResumeWindow({ index: restoredEntry.currentIndex, anchor: restoredEntry.questionAnchor });
    setExamFilter(restoredEntry.sessionFilters?.exam ?? '');
    setSelectedClassificationConcepts(new Set(restoredEntry.sessionFilters?.concept?.split(',').filter(Boolean) ?? []));
    setSelectedLetters(new Set((restoredEntry.sessionFilters?.letter ?? initialLetterParam ?? '').split(',').filter(Boolean)));
  }

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
  const savedFilters = resumeWindow.filters ?? resumeEntry?.sessionFilters;
  const matchesResumeFilters = (examFilter || '') === (savedFilters?.exam || '')
    && Array.from(selectedClassificationConcepts).join(',') === (savedFilters?.concept || '')
    && Array.from(selectedLetters).join(',') === (savedFilters?.letter || initialLetterParam || '');

  const {
    questions: apiQuestions,
    ensureQuestion,
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
    enabled: !authLoading && (!restoredEntry || Boolean(resumeEntry)),
    resumeIndex: matchesResumeFilters ? resumeWindow.index : undefined,
    anchor: matchesResumeFilters ? resumeWindow.anchor : undefined,
    // Unfiltered totals already arrive in metadata. Filter combinations need an exact count.
    includeTotal: Boolean(selectedRawExams || selectedClassificationConcepts.size || selectedLetters.size),
    exam: selectedRawExams,
    concept:
      selectedClassificationConcepts.size > 0
        ? Array.from(selectedClassificationConcepts).join(",")
        : undefined,
    letter: selectedLetters.size > 0 ? Array.from(selectedLetters).join(",") : undefined,
  });

  // Only concepts present in this topic/mode's stored questions are selectable.
  const conceptOptions = useMemo(
    () => Array.from(new Set((meta?.concepts ?? []).filter(Boolean))),
    [meta?.concepts],
  );

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

  const classificationGroups = useMemo<ClassificationGroup[]>(() =>
    (meta?.conceptGroups ?? [])
      .map((group) => ({
        ...group,
        icon: "",
        accent: "var(--ui-accent)",
        bg: "var(--ui-muted-surface)",
        border: "var(--ui-border)",
      }))
      .sort(
        (a, b) =>
          (b.concepts?.length ?? 0) - (a.concepts?.length ?? 0) ||
          a.label.localeCompare(b.label),
      ),
    [meta?.conceptGroups],
  );

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
    () => Object.fromEntries(classificationGroups.map(group => [group.label, group.concepts.length])),
    [classificationGroups],
  );

  const questions = useMemo(() => {
    if (!apiQuestions) return [];
    const fallbackConcept = "General";
    const quizOnlyQuestions = apiQuestions.filter(
      (item) => !isStudyModeQuestion(item),
    );
    return ensureUniqueQuestionIds(
      quizOnlyQuestions.map((item, index) =>
        toQuizQuestion(item, index, fallbackConcept),
      ),
    );
  }, [apiQuestions]);

  const hasActiveFilters =
    (examFilter && examFilter !== "all") ||
    selectedClassificationConcepts.size > 0 ||
    selectedLetters.size > 0;

  const availableCount = hasActiveFilters ? (apiTotalCount ?? 0) : (apiTotalCount || (meta?.total ?? 0));

  return {
    setResumeWindow,
    ensureQuestion,
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
    groupingStatus: meta?.groupingStatus,
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
