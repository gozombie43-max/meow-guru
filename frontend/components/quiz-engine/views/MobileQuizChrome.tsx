import { LangToggle } from "@/components/LangToggle";
import { SettingIcon } from "@/components/quiz-engine/ui/QuizSettingsModal";
import { Menu } from "lucide-react";
import type { QuizController } from "../hooks/useQuizController";

type HeaderProps = Pick<
  QuizController,
  | "activeLang"
  | "currentIndex"
  | "hideQuestionNumbers"
  | "isSettingsOpen"
  | "isTranslating"
  | "openPalette"
  | "setActiveLang"
  | "setIsSettingsOpen"
>;

export function MobileQuizHeader({ activeLang, currentIndex, hideQuestionNumbers, isSettingsOpen, isTranslating, openPalette, setActiveLang, setIsSettingsOpen }: HeaderProps) {
  const questionNumber = currentIndex + 1;
  const digits = String(questionNumber).length;
  const sizeClass = digits <= 2 ? "is-qnum-sm" : digits === 3 ? "is-qnum-md" : "is-qnum-lg";

  return (
    <header className="ios-series-header">
      <button type="button" className={`ios-series-icon-button ${isSettingsOpen ? "is-active" : ""}`} onClick={() => setIsSettingsOpen((previous) => !previous)} aria-label="Open quiz settings" aria-expanded={isSettingsOpen}>
        <SettingIcon />
      </button>
      <LangToggle active={activeLang} loading={isTranslating} onChange={setActiveLang} />
      <button type="button" className={`ios-series-icon-button ${hideQuestionNumbers ? `is-qnum ${sizeClass}` : ""}`} onClick={openPalette} aria-label={hideQuestionNumbers ? `Question ${questionNumber} - Open question navigator` : "Open question navigator"}>
        {hideQuestionNumbers ? <span className="ios-series-palette-num">{questionNumber}</span> : <Menu aria-hidden="true" />}
      </button>
    </header>
  );
}

type FooterProps = Pick<
  QuizController,
  "currentIndex" | "handleNext" | "handlePrev" | "handleSubmitCurrent" | "questions"
> & {
  canSubmit: boolean;
  isCurrentSubmitted: boolean;
};

export function MobileQuizFooter({ canSubmit, currentIndex, handleNext, handlePrev, handleSubmitCurrent, isCurrentSubmitted, questions }: FooterProps) {
  return (
    <footer className="ios-series-footer">
      <button type="button" onClick={handlePrev} disabled={currentIndex === 0} className="ios-series-footer-secondary">Previous</button>
      <button type="button" onClick={() => isCurrentSubmitted ? handleNext() : handleSubmitCurrent()} disabled={!canSubmit && !isCurrentSubmitted} className="ios-series-footer-primary">
        {!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}
      </button>
    </footer>
  );
}
