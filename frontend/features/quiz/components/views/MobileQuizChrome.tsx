import BackButton from "@/components/BackButton";
import { LangToggle } from "@/components/LangToggle";
import { Menu, Settings, ArrowLeft, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";

function SolutionIcon({ className = "ios-series-pill-icon solution-icon" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M8 2.5v3M12 2.5v3M16 2.5v3M8 10h8M8 14h8M8 18h5" />
    </svg>
  );
}

function GeminiIcon({ className = "ios-series-pill-icon ai-icon" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <linearGradient
        id="ios-gemini-gradient"
        x1="3.906"
        x2="45.428"
        y1="3.906"
        y2="45.428"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ca5df5" />
        <stop offset=".036" stopColor="#c05ff4" />
        <stop offset=".293" stopColor="#806cea" />
        <stop offset=".528" stopColor="#4d77e3" />
        <stop offset=".731" stopColor="#297fdd" />
        <stop offset=".895" stopColor="#1283da" />
        <stop offset="1" stopColor="#0a85d9" />
      </linearGradient>
      <path
        fill="url(#ios-gemini-gradient)"
        d="M46.117 23.081l-.995-.04h-.002C34.243 22.613 25.387 13.757 24.959 2.88l-.04-.996C24.9 1.39 24.494 1 24 1s-.9.39-.919.883l-.04.996C22.612 13.756 13.756 22.612 2.878 23.041l-.995.04C1.39 23.1 1 23.506 1 24s.39.9.884.919l.995.039c10.877.43 19.733 9.286 20.162 20.163l.04.996C23.1 46.61 23.506 47 24 47s.9-.39.919-.883l.04-.996c.429-10.877 9.285-19.733 20.162-20.163l.995-.039C46.61 24.9 47 24.494 47 24s-.39-.9-.883-.919z"
      />
    </svg>
  );
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
  | "hideQuestionNumbers"
  | "isSettingsOpen"
  | "isTranslating"
  | "openPalette"
  | "setActiveLang"
  | "setIsSettingsOpen"
>;

export function MobileQuizHeader({ routeBase, subjectConfig, slug, activeLang, currentIndex, hideQuestionNumbers, isSettingsOpen, isTranslating, openPalette, setActiveLang, setIsSettingsOpen }: HeaderProps) {
  const questionNumber = currentIndex + 1;
  const digits = String(questionNumber).length;
  const sizeClass = digits <= 2 ? "is-qnum-sm" : digits === 3 ? "is-qnum-md" : "is-qnum-lg";

  return (
    <header data-ui-chrome="header" className="ios-series-header">
      <div className="ios-series-header-left">
        <BackButton href={routeBase ?? `/${subjectConfig.subjectId}/${slug}`} label="Leave quiz" className="ios-series-icon-button" />
      </div>
      <div className="ios-series-header-center">
        <LangToggle active={activeLang} loading={isTranslating} onChange={setActiveLang} />
      </div>
      <div className="ios-series-header-right">
        <button data-ui-button="state" data-ui-shape="icon" type="button" className={`ios-series-icon-button ${isSettingsOpen ? "is-active" : ""}`} onClick={() => setIsSettingsOpen((previous) => !previous)} aria-label="Open quiz settings" aria-expanded={isSettingsOpen}>
          <Settings aria-hidden="true" />
        </button>
        <button data-ui-button="state" data-ui-shape="icon" type="button" className={`ios-series-icon-button ${hideQuestionNumbers ? `is-qnum ${sizeClass}` : ""}`} onClick={openPalette} aria-label={hideQuestionNumbers ? `Question ${questionNumber} - Open question navigator` : "Open question navigator"}>
          {hideQuestionNumbers ? <span className="ios-series-palette-num">{questionNumber}</span> : <Menu aria-hidden="true" />}
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
    document.getElementById("mobile-quiz-chatbot-trigger")?.click();
  };

  const showPill = !(hideViewSolution && hideAiTutor);

  return (
    <footer data-ui-chrome="footer" className="ios-series-footer">
      {/* Render the actual QuizChatbot outside so it can be triggered programmatically */}
      {!hideAiTutor && currentQ && (
        <QuizChatbot
          key={`ios-chat-${currentQ.id}`}
          isVisible={isCurrentSubmitted}
          questionNumber={currentIndex + 1}
          topicTitle={title}
          question={currentQ}
          theme={theme}
          activeLang={activeLang}
          renderTrigger={(onOpen) => (
            <button
              id="mobile-quiz-chatbot-trigger"
              type="button"
              style={{ display: 'none' }}
              onClick={onOpen}
              aria-hidden="true"
            />
          )}
        />
      )}

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
              <span className="ios-series-pill-label">Ask AI</span>
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
    </footer>
  );
}
