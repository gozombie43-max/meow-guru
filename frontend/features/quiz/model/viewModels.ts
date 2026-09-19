import type { MobileQuizFields, MobileQuizViewProps } from '../components/views/MobileQuizView';
import type { DesktopQuizFields, DesktopQuizViewProps } from '../components/views/DesktopQuizView';

function pick<T, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, source[key]])) as Pick<T, K>;
}

export function mobileQuizViewModel(model: MobileQuizFields): MobileQuizViewProps {
  return {
    configuration: pick(model, ["routeBase","slug","subjectConfig","theme","themeStyles","toggleTheme","title"]),
    settings: pick(model, ["isSettingsOpen","setIsSettingsOpen","hideQuestionNumbers","handleToggleHideQuestionNumbers","hideViewSolution","handleToggleHideViewSolution","hideAiTutor","handleToggleHideAiTutor","handleToggleHideBoth","textSize","handleSetTextSize","spacing","handleSetSpacing"]),
    question: pick(model, ["activeLang","isTranslating","setActiveLang","currentQ","conceptColours","hasDetailedExamLabel","examDetailsRef","compactExamLabel","fullExamLabel","hasQuestionText","displayedQuestion","renderQuestionLine","displayedOptions"]),
    navigation: pick(model, ["currentIndex","openPalette","questions","selectedAnswers","submittedQuestions","activeRailBtnRef","goToQuestion","handlePrev","handleNext","isPaletteOpen","closePalette"]),
    answer: pick(model, ["isCurrentSubmitted","selectedAnswer","handleSelectAnswer","submitError","handleSubmitCurrent","canSubmit","timerRef","results"]),
    solution: pick(model, ["openSolution","isSolutionOpen","closeSolution"]),
  };
}

export function desktopQuizViewModel(model: DesktopQuizFields): DesktopQuizViewProps {
  return {
    configuration: pick(model, ["routeBase","slug","subjectConfig","theme","themeStyles","title","modeLabels","mode","toggleTheme"]),
    question: pick(model, ["activeLang","isTranslating","setActiveLang","currentQ","conceptColours","handleBookmark","bookmarked","hasQuestionText","displayedQuestion","renderQuestionLine","displayedOptions"]),
    navigation: pick(model, ["questions","currentIndex","selectedAnswers","submittedQuestions","activeMacBtnRef","goToQuestion","handlePrev","handleNext"]),
    answer: pick(model, ["isCurrentSubmitted","selectedAnswer","handleSelectAnswer","submitError","canViewSolution","handleSubmitCurrent","canSubmit"]),
    solution: pick(model, ["openSolution","isSolutionOpen","closeSolution"]),
    settings: pick(model, ["isSettingsOpen","setIsSettingsOpen","hideQuestionNumbers","handleToggleHideQuestionNumbers","hideViewSolution","handleToggleHideViewSolution","hideAiTutor","handleToggleHideAiTutor","handleToggleHideBoth","textSize","handleSetTextSize","spacing","handleSetSpacing"]),
  };
}
