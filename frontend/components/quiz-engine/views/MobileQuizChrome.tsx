import BackButton from "@/components/BackButton";
import { LangToggle } from "@/components/LangToggle";
import { Menu, Settings, FileText } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { QuizController } from "../hooks/useQuizController";

function GeminiIcon({ className = "ios-series-review-svg" }: { className?: string }) {
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

export function MobileQuizFooter({
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
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Close when navigating to another question
  useEffect(() => {
    setIsReviewOpen(false);
  }, [currentIndex]);

  const handleNextOrSubmit = () => {
    setIsReviewOpen(false);
    if (isCurrentSubmitted) {
      handleNext();
    } else {
      handleSubmitCurrent();
    }
  };

  const handleOpenSolution = () => {
    setIsReviewOpen(false);
    openSolution();
  };

  return (
    <footer data-ui-chrome="footer" className="ios-series-footer">
      <AnimatePresence>
        {isReviewOpen && (
          <>
            <div
              className="ios-series-review-backdrop"
              onClick={() => setIsReviewOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              className="ios-series-review-panel"
              role="dialog"
              aria-label="Review options"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="ios-series-review-handle" aria-hidden="true" />

              {!hideViewSolution && (
                <button
                  type="button"
                  className="ios-series-review-item"
                  onClick={handleOpenSolution}
                  aria-label="View solution - Detailed explanation"
                >
                  <div className="ios-series-review-icon" aria-hidden="true">
                    <FileText className="ios-series-review-svg" />
                  </div>
                  <div className="ios-series-review-text">
                    <span className="ios-series-review-title">View solution</span>
                    <span className="ios-series-review-desc">Detailed explanation</span>
                  </div>
                </button>
              )}

              {!hideAiTutor && currentQ && (
                <button
                  type="button"
                  className="ios-series-review-item"
                  onClick={() => {
                    setIsReviewOpen(false);
                    // We need a way to trigger the chatbot from outside
                    document.getElementById('mobile-quiz-chatbot-trigger')?.click();
                  }}
                  aria-label="Ask AI Tutor - Discuss this question"
                >
                  <div className="ios-series-review-icon" aria-hidden="true">
                    <GeminiIcon className="ios-series-review-svg" />
                  </div>
                  <div className="ios-series-review-text">
                    <span className="ios-series-review-title">Ask AI Tutor</span>
                    <span className="ios-series-review-desc">Discuss this question</span>
                  </div>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Render the actual QuizChatbot outside the panel so it doesn't unmount when the panel closes */}
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

      <button
        data-ui-button="secondary"
        type="button"
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className="ios-series-footer-btn ios-series-footer-prev"
      >
        Previous
      </button>

      <button
        type="button"
        onClick={() => setIsReviewOpen((prev) => !prev)}
        className={`ios-series-footer-btn ios-series-footer-review ${isReviewOpen ? "is-active" : ""}`}
        aria-expanded={isReviewOpen}
        aria-haspopup="dialog"
        disabled={!isCurrentSubmitted || (hideViewSolution && hideAiTutor)}
      >
        Review
      </button>

      <button
        data-ui-button="primary"
        type="button"
        onClick={handleNextOrSubmit}
        disabled={!canSubmit && !isCurrentSubmitted}
        className="ios-series-footer-btn ios-series-footer-next"
        aria-label={!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}
      >
        {!isCurrentSubmitted ? "Submit" : currentIndex < questions.length - 1 ? "Next" : "Finish"}
      </button>
    </footer>
  );
}
