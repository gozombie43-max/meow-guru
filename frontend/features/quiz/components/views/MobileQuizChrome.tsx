import BackButton from "@/components/BackButton";
import { LangToggle } from "@/components/LangToggle";
import { Menu, Settings, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";

function GeminiIcon({ className = "ios-series-picker-svg" }: { className?: string }) {
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
  const [isPressing, setIsPressing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [choice, setChoice] = useState<"left" | "right" | null>(null);

  const startCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const choiceRef = useRef<"left" | "right" | null>(null);
  const isPickerOpenRef = useRef(false);

  const HOLD_MS = 200;
  const SELECT_X = 40;

  const vibrate = (ms = 8) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore haptic errors
      }
    }
  };

  const updateChoice = (next: "left" | "right" | null) => {
    if (choiceRef.current === next) return;
    choiceRef.current = next;
    setChoice(next);

    if (next === "left" || next === "right") {
      vibrate(8);
    }
  };

  const clearHoldState = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setIsPressing(false);
    setIsPickerOpen(false);
    isPickerOpenRef.current = false;
    updateChoice(null);
    activePointerId.current = null;
  };

  // Question changes remount the controls; only the external timer needs cleanup.
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const handleNextOrSubmit = () => {
    if (isCurrentSubmitted) {
      handleNext();
    } else {
      handleSubmitCurrent();
    }
  };

  const handleOpenSolution = () => {
    openSolution();
  };

  const handleOpenAiTutor = () => {
    document.getElementById("mobile-quiz-chatbot-trigger")?.click();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isCurrentSubmitted || (hideViewSolution && hideAiTutor) || e.button !== 0) return;
    activePointerId.current = e.pointerId;
    startCoords.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is not supported
    }

    holdTimer.current = setTimeout(() => {
      setIsPickerOpen(true);
      isPickerOpenRef.current = true;
      setIsPressing(false);
      vibrate(12);
    }, HOLD_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;

    const dx = e.clientX - startCoords.current.x;
    const dy = e.clientY - startCoords.current.y;

    if (!isPickerOpenRef.current) {
      if (Math.hypot(dx, dy) > 25) {
        clearHoldState();
      }
      return;
    }

    if (dx <= -SELECT_X && !hideViewSolution) {
      updateChoice("left");
    } else if (dx >= SELECT_X && !hideAiTutor) {
      updateChoice("right");
    } else {
      updateChoice(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;

    const finalChoice = choiceRef.current;
    const wasPickerOpen = isPickerOpenRef.current;

    clearHoldState();

    if (wasPickerOpen && finalChoice === "left") {
      handleOpenSolution();
    } else if (wasPickerOpen && finalChoice === "right") {
      handleOpenAiTutor();
    }
  };

  const handlePointerCancel = () => {
    clearHoldState();
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

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

      <button
        data-ui-button="secondary"
        type="button"
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className="ios-series-footer-btn ios-series-footer-prev"
      >
        <ArrowLeft className="ios-series-btn-arrow" aria-hidden="true" />
        <span>Previous</span>
      </button>

      <div
        className={`ios-series-picker-wrap ${isPickerOpen ? "is-open" : ""} ${
          isPressing ? "is-pressing" : ""
        } ${choice === "left" ? "choice-left" : ""} ${
          choice === "right" ? "choice-right" : ""
        }`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Floating Action Rail */}
        <div
          className="ios-series-picker-rail"
          role="region"
          aria-label="Hold and swipe solution picker"
        >
          <div className="ios-series-rail-grid">
            <div
              className={`ios-series-picker-choice is-left ${
                hideViewSolution ? "is-hidden" : ""
              }`}
            >
              <div className="ios-series-picker-choice-icon">
                <FileText className="ios-series-picker-svg" aria-hidden="true" />
              </div>
              <div>
                <div className="ios-series-picker-choice-title">View Solution</div>
                <div className="ios-series-picker-choice-sub">Answer + explanation</div>
              </div>
            </div>

            <div
              className={`ios-series-picker-choice is-right ${
                hideAiTutor ? "is-hidden" : ""
              }`}
            >
              <div className="ios-series-picker-choice-icon">
                <GeminiIcon className="ios-series-picker-svg" />
              </div>
              <div>
                <div className="ios-series-picker-choice-title">Ask AI Tutor</div>
                <div className="ios-series-picker-choice-sub">Discuss question</div>
              </div>
            </div>
          </div>
        </div>

        {/* Hold Ring */}
        <div className="ios-series-hold-ring" aria-hidden="true" />

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          onContextMenu={(e) => e.preventDefault()}
          className="ios-series-footer-btn ios-series-footer-solution"
          aria-expanded={isPickerOpen}
          aria-label="Solution - Hold and swipe for options"
          disabled={!isCurrentSubmitted || (hideViewSolution && hideAiTutor)}
        >
          <svg
            className="ios-series-btn-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18h6M10 22h4" />
            <path d="M8.2 14.6A7 7 0 1 1 15.8 14.6c-.9.8-1.3 1.5-1.5 2.4H9.7c-.2-.9-.6-1.6-1.5-2.4Z" />
          </svg>
          <span>Solution</span>
        </button>
      </div>

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
