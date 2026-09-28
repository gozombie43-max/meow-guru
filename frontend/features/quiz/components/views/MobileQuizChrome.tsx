import { useRef } from "react";
import { LangToggle } from "@/components/LangToggle";
import { Settings, ArrowLeft, ArrowRight, BookOpenText } from "lucide-react";
import dynamic from "next/dynamic";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";

function SolutionIcon({ className }: { className?: string }) {
  return <BookOpenText className={className} aria-hidden="true" />;
}

function GeminiIcon({ className }: { className?: string }) {
  return <span className={className} aria-hidden="true" style={{ backgroundColor: "currentColor", mask: 'url("/icons8-gemini-ai.svg") center / contain no-repeat', WebkitMask: 'url("/icons8-gemini-ai.svg") center / contain no-repeat' }} />;
}

const QuizChatbot = dynamic(() => import("@/components/QuizChatbot"), {
  ssr: false,
});

type HeaderProps = Pick<
  QuizController,
  | "routeBase"
  | "subjectConfig"
  | "slug"
  | "activeLang"
  | "currentIndex"
  | "questions"
  | "hasMore"
  | "hideQuestionNumbers"
  | "isSettingsOpen"
  | "isTranslating"
  | "openPalette"
  | "setActiveLang"
  | "setIsSettingsOpen"
>;

export function MobileQuizHeader({ activeLang, currentIndex, questions, hasMore, isSettingsOpen, isTranslating, openPalette, setActiveLang, setIsSettingsOpen }: HeaderProps) {
  const questionNumber = currentIndex + 1;

  return (
    <header data-ui-chrome="header" className="ios-series-header">
      <div className="ios-series-header-left">
        <button data-ui-button="state" data-ui-shape="icon" type="button" className={`ios-series-icon-button ios-series-settings-trigger ${isSettingsOpen ? "is-active" : ""}`} onClick={() => setIsSettingsOpen((previous) => !previous)} aria-label="Open quiz settings" aria-expanded={isSettingsOpen}>
          <Settings aria-hidden="true" />
        </button>
      </div>
      <div className="ios-series-header-center">
        <LangToggle active={activeLang} loading={isTranslating} onChange={setActiveLang} />
      </div>
      <div className="ios-series-header-right">
        <button data-ui-button="state" type="button" className="ios-series-icon-button ios-series-palette-trigger" onClick={openPalette} aria-label={`Question ${questionNumber} of ${questions.length}${hasMore ? " loaded, more available" : ""} - Open question navigator`}>
          <span className="ios-series-palette-num">{String(questionNumber).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}{hasMore ? "+" : ""}</span>
        </button>
      </div>
    </header>
  );
}

type FooterProps = Pick<
  QuizController,
  | "currentIndex"
  | "handleNext"
  | "handlePrev"
  | "handleSubmitCurrent"
  | "questions"
  | "currentQ"
  | "openSolution"
  | "title"
  | "theme"
  | "activeLang"
  | "hideViewSolution"
  | "hideAiTutor"
> & {
  canSubmit: boolean;
  isCurrentSubmitted: boolean;
};

export function MobileQuizFooter(props: FooterProps) {
  return <MobileQuizFooterControls key={props.currentQ?.id ?? props.currentIndex} {...props} />;
}

function MobileQuizFooterControls({
  canSubmit,
  currentIndex,
  handleNext,
  handlePrev,
  handleSubmitCurrent,
  isCurrentSubmitted,
  questions,
  currentQ,
  openSolution,
  title,
  theme,
  activeLang,
  hideViewSolution = false,
  hideAiTutor = false,
}: FooterProps) {
  const openChatbotRef = useRef<(() => void) | null>(null);
  const pendingOpenRef = useRef(false);

  const handleNextOrSubmit = () => {
    if (isCurrentSubmitted) {
      handleNext();
    } else {
      handleSubmitCurrent();
    }
  };

  const handleOpenSolution = () => {
    if (!isCurrentSubmitted || hideViewSolution) return;
    openSolution();
  };

  const handleOpenAiTutor = () => {
    if (!isCurrentSubmitted || hideAiTutor) return;
    if (openChatbotRef.current) {
      openChatbotRef.current();
    } else {
      pendingOpenRef.current = true;
      document.getElementById("mobile-quiz-chatbot-trigger")?.click();
    }
  };

  const showPill = !(hideViewSolution && hideAiTutor);

  return (
    <footer data-ui-chrome="footer" className="ios-series-footer">
      {/* Render the actual QuizChatbot outside so it can be triggered programmatically */}
      {!hideAiTutor && isCurrentSubmitted && currentQ && (
        <QuizChatbot
          key={`ios-chat-${currentQ.id}`}
          isVisible={isCurrentSubmitted}
          questionNumber={currentIndex + 1}
          topicTitle={title}
          question={currentQ}
          theme={theme}
          activeLang={activeLang}
          renderTrigger={(onOpen) => {
            openChatbotRef.current = onOpen;
            if (pendingOpenRef.current) {
              pendingOpenRef.current = false;
              setTimeout(onOpen, 0);
            }
            return (
              <button
                id="mobile-quiz-chatbot-trigger"
                type="button"
                style={{ display: 'none' }}
                onClick={onOpen}
                aria-hidden="true"
              />
            );
          }}
        />
      )}

      <div className="ios-series-dock">
      {/* 1. Left: Previous Button */}
      <button
        data-ui-button="secondary"
        type="button"
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className="ios-series-footer-btn ios-series-footer-prev"
        aria-label="Previous question"
      >
        <ArrowLeft className="ios-series-btn-arrow" aria-hidden="true" />
        <span>Previous</span>
      </button>

      {/* 2. Middle: Dual Action Capsule [ Solution | Ask AI ] */}
      {showPill && (
        <div
          className={`ios-series-footer-pill ${!isCurrentSubmitted ? "is-unsubmitted" : ""}`}
          role="group"
          aria-label="Solution and AI Tutor actions"
        >
          {!hideViewSolution && (
            <button
              data-ui-button="state"
              type="button"
              onClick={handleOpenSolution}
              disabled={!isCurrentSubmitted}
              className={`ios-series-pill-item ios-series-pill-solution ${!isCurrentSubmitted ? "is-disabled" : ""}`}
              aria-label="View solution"
            >
              <SolutionIcon className="ios-series-pill-icon solution-icon" />
              <span className="ios-series-pill-label">Solution</span>
            </button>
          )}

          {!hideViewSolution && !hideAiTutor && (
            <div className="ios-series-pill-divider" aria-hidden="true" />
          )}

          {!hideAiTutor && (
            <button
              data-ui-button="state"
              type="button"
              onClick={handleOpenAiTutor}
              disabled={!isCurrentSubmitted}
              className={`ios-series-pill-item ios-series-pill-ai ${!isCurrentSubmitted ? "is-disabled" : ""}`}
              aria-label="Ask AI tutor"
            >
              <GeminiIcon className="ios-series-pill-icon ai-icon" />
              <span className="ios-series-pill-label">AI</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Right: Next / Submit Button */}
      <button
        data-ui-button="primary"
        type="button"
        onClick={handleNextOrSubmit}
        disabled={!canSubmit && !isCurrentSubmitted}
        className="ios-series-footer-btn ios-series-footer-next"
        aria-label={!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}
      >
        <span>{!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}</span>
        {isCurrentSubmitted && <ArrowRight className="ios-series-btn-arrow" aria-hidden="true" />}
      </button>
      </div>
    </footer>
  );
}
