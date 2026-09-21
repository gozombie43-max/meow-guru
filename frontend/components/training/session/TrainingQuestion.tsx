import { Info, Check } from "lucide-react";
import RichContent from "@/components/RichContent";

interface TrainingQuestionProps {
  q: import("../training-types").TrainingQuestion;
  choice: number | null;
  setChoice: (choice: number) => void;
  busy: boolean;
  remaining: number;
}

export function TrainingQuestion({ q, choice, setChoice, busy, remaining }: TrainingQuestionProps) {
  if (!q) return null;

  return (
    <>
      <div className="training-question-tags">
        {q.trainingBlock && (
          <span className="training-tag-block">{q.trainingBlock}</span>
        )}
        <span className="training-tag-topic">
          {q.topic || q.subject}
        </span>
        <span className="training-tag-difficulty">
          <span className={`diff-dot diff-${q.difficulty}`} />
          Level {q.difficulty}
        </span>
        <span className="training-tag-source">
          {q.sourceType === "pyq" ? "PYQ" : "Question bank"}
        </span>
        <details key={q.id} className="training-question-info">
          <summary aria-label="Question exam details" title="Question exam details" onKeyDown={event => {
            if (event.key === "Escape") {
              event.currentTarget.parentElement?.removeAttribute("open");
              event.currentTarget.focus();
            }
          }}>
            <Info size={18} aria-hidden="true" />
          </summary>
          <div className="training-question-info-content">
            <strong>Question source</strong>
            <dl>
              <div><dt>Exam</dt><dd>{q.examName || "Not recorded"}</dd></div>
              <div><dt>Year</dt><dd>{q.year || "Not recorded"}</dd></div>
            </dl>
          </div>
        </details>
      </div>

      <div className="training-question-text" key={q.id} tabIndex={-1}>
        <RichContent text={q.text} />
        {q.image && (
          <div className="training-question-image-wrap">
            <RichContent
              text={`![Question illustration](${q.image})`}
            />
          </div>
        )}
      </div>

      <div
        className="training-answers"
        role="radiogroup"
        aria-label="Answer choices"
      >
        {q.options.map((option: string, index: number) => {
          const isSelected = choice === index;
          return (
            <button
              key={index}
              type="button"
              role="radio"
              data-ui-button="state"
              className={`training-option-btn ${isSelected ? "selected" : ""}`}
              aria-checked={isSelected}
              disabled={busy || remaining === 0}
              onClick={() => setChoice(index)}
            >
              <span className="training-option-letter">
                {String.fromCharCode(65 + index)}
              </span>
              <div className="training-option-content">
                <RichContent text={option} />
              </div>
              <span className="training-option-check" aria-hidden="true">{isSelected && <Check size={16} />}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
