"use client";
import MathText from "@/components/MathText";
import { useQuizTheme,useQuizThemeControls } from "@/features/quiz/components/QuizThemeProvider";
import type { SubjectConfig } from "@/features/quiz/model/types";
import { QuizThemeStyles } from "@/features/quiz/components/ui/QuizStyles";
import { useQuizPreferences } from "@/features/quiz/components/useQuizPreferences";
import { MODE_LABELS } from "@/features/quiz/model/utils";
import { useBackLayer } from "@/hooks/useAppNavigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { preferredScrollBehavior } from "@/lib/motion";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

export function useQuizPresentation(subjectConfig: SubjectConfig, presentation: string = "default") {
  const activeRailBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeMacBtnRef = useRef<HTMLButtonElement | null>(null);
  const examDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const isLargeScreen = useMediaQuery("(min-width: 769px)");

  const isIos =
    presentation !== "default"
      ? presentation.startsWith("ios")
      : !isLargeScreen;
  const isMac =
    presentation !== "default" ? presentation.startsWith("mac") : isLargeScreen;
  const theme = useQuizTheme();
  const { toggleTheme } = useQuizThemeControls();
  const modeLabels = useMemo(
    () => ({
      ...MODE_LABELS,
      ...subjectConfig.modeLabels,
      formula: subjectConfig.formulaModeLabel ?? MODE_LABELS.formula,
    }),
    [subjectConfig.formulaModeLabel, subjectConfig.modeLabels],
  );
  const themeStyles = (
    <QuizThemeStyles cssClassName={subjectConfig.cssClassName} />
  );

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    hideQuestionNumbers,
    hideSubtopic,
    toggleHideSubtopic: handleToggleHideSubtopic,
    hideViewSolution,
    hideAiTutor,
    textSize,
    textWeight,
    spacing,
    toggleHideQuestionNumbers: handleToggleHideQuestionNumbers,
    toggleHideViewSolution: handleToggleHideViewSolution,
    toggleHideAiTutor: handleToggleHideAiTutor,
    toggleHideBoth: handleToggleHideBoth,
    setTextSize: handleSetTextSize,
    setTextWeight: handleSetTextWeight,
    setSpacing: handleSetSpacing,
  } = useQuizPreferences();

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);
  useBackLayer(isPaletteOpen && !isIos, closePalette);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const scrollActiveQuestion = useCallback(() => {
    if (activeRailBtnRef.current) {
      try {
        activeRailBtnRef.current.scrollIntoView({
          behavior: preferredScrollBehavior(),
          block: "nearest",
          inline: "center",
        });
      } catch {}
    }
    if (activeMacBtnRef.current) {
      try {
        activeMacBtnRef.current.scrollIntoView({
          behavior: preferredScrollBehavior(),
          block: "nearest",
          inline: "center",
        });
      } catch {}
    }
  }, []);

  useEffect(() => {
    const dismissExamDetails = (event: PointerEvent) => {
      const details = examDetailsRef.current;
      if (!details?.open) return;

      const summary = details.querySelector("summary");
      if (event.target instanceof Node && summary?.contains(event.target))
        return;

      details.removeAttribute("open");
    };

    document.addEventListener("pointerdown", dismissExamDetails);
    return () =>
      document.removeEventListener("pointerdown", dismissExamDetails);
  }, []);

  const renderQuestionLine = useCallback((line: string) => {
    const regex = /(?:\*\*'([^']+)'\*\*|__'([^']+)'__|'([^']+)')/g;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let tokenIndex = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = line.slice(lastIndex, match.index);
        nodes.push(<MathText key={`q-chunk-${tokenIndex++}`} text={textBefore} />);
      }

      const boldQuoted = match[1] ?? match[2];
      if (boldQuoted !== undefined) {
        nodes.push(
          <strong key={`q-chunk-${tokenIndex++}`} className="font-bold">
            <span className="quote-highlight">
              <MathText text={`'${boldQuoted}'`} />
            </span>
          </strong>
        );
      } else {
        const quoted = match[3];
        nodes.push(
          <span key={`q-chunk-${tokenIndex++}`} className="quote-highlight">
            <MathText text={`'${quoted}'`} />
          </span>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      nodes.push(<MathText key={`q-chunk-${tokenIndex++}`} text={line.slice(lastIndex)} />);
    }

    return nodes;
  }, []);

  return { activeRailBtnRef, activeMacBtnRef, examDetailsRef, isIos, isMac, theme, toggleTheme,
    modeLabels, themeStyles, isPaletteOpen, isSettingsOpen, setIsSettingsOpen,
    hideQuestionNumbers, hideSubtopic, handleToggleHideSubtopic, hideViewSolution, hideAiTutor, textSize, textWeight, spacing,
    handleToggleHideQuestionNumbers, handleToggleHideViewSolution, handleToggleHideAiTutor,
    handleToggleHideBoth, handleSetTextSize, handleSetTextWeight, handleSetSpacing, openPalette, closePalette,
    isDesktop, touchStartXRef, touchStartYRef, scrollActiveQuestion, renderQuestionLine };
}
