import { Dialog } from "@/components/ui/Dialog";
import { getQuestionStatus } from "@/features/quiz/model/utils";
import { X } from "lucide-react";
import type { QuizController } from "@/features/quiz/hooks/useQuizController";
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

type Props = Pick<
  QuizController,
  | "activeRailBtnRef"
  | "closePalette"
  | "currentIndex"
  | "goToQuestion"
  | "isPaletteOpen"
  | "hasMore"
  | "isFetchingMore"
  | "fetchMore"
  | "questions"
  | "selectedAnswers"
  | "submittedQuestions"
> & {
  hideQuestionNumbers: boolean;
};

function statusClass(status: ReturnType<typeof getQuestionStatus>) {
  return `${status === "current" ? "is-current" : ""} ${status === "correct" ? "is-correct" : ""} ${status === "wrong" ? "is-wrong" : ""} ${status === "answered" ? "is-unsubmitted" : ""}`;
}

export function MobileQuestionNavigator({ activeRailBtnRef, closePalette, currentIndex, goToQuestion, hideQuestionNumbers, isPaletteOpen, questions, selectedAnswers, submittedQuestions, hasMore, isFetchingMore, fetchMore }: Props) {
  "use no memo"; // Virtualizer methods read mutable scroll state and must not be compiler-memoized.
  const railRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const large = questions.length > 100;
  // This component opts out of compilation above; virtualizer instances stay local.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rail = useVirtualizer({ count: questions.length, getScrollElement: () => railRef.current, horizontal: true, estimateSize: () => 50, overscan: 4, enabled: large && !hideQuestionNumbers, initialRect: { width: 390, height: 44 } });
  const grid = useVirtualizer({ count: Math.ceil(questions.length / 5), getScrollElement: () => gridRef.current, estimateSize: () => 54, overscan: 3, enabled: large && isPaletteOpen, initialRect: { width: 350, height: 500 } });
  useEffect(() => { if (large && !hideQuestionNumbers) rail.scrollToIndex(currentIndex, { align: 'auto' }); }, [large, hideQuestionNumbers, currentIndex, rail]);
  const getStatus = (index: number) => getQuestionStatus({
    index,
    currentIndex,
    selectedAnswers,
    questions,
    submittedQuestions,
  });

  return (
    <>
      {!hideQuestionNumbers && (
        <nav ref={railRef} className="ios-series-rail" aria-label="Question navigation">
          <div style={large ? { position: 'relative', height: 44, minWidth: rail.getTotalSize() } : { display: 'contents' }}>
          {(large ? rail.getVirtualItems().map(item => ({ question: questions[item.index], index: item.index, start: item.start })) : questions.map((question, index) => ({ question, index, start: 0 }))).map(({ question, index, start }) => {
            const status = getStatus(index);
            const statusLabel = status === "wrong" ? "incorrect" : status === "not-answered" ? "unvisited" : status;
            return (
              <button data-ui-button="state"
                key={`rail-${question.id}-${index}`}
                type="button"
                ref={index === currentIndex ? activeRailBtnRef : null}
                onClick={() => goToQuestion(index + 1)}
                className={`ios-series-question ${statusClass(status)}`}
                style={large ? { position: 'absolute', left: start, top: 0 } : undefined}
                aria-label={`Question ${index + 1}, ${statusLabel}`}
                aria-current={index === currentIndex ? "step" : undefined}
              >
                <span className="ios-series-question-num">{index + 1}</span>
                {index === currentIndex && (
                  <span className="ios-series-question-bar" aria-hidden="true" />
                )}
              </button>
            );
          })}
          </div>
        </nav>
      )}

      {isPaletteOpen && (
        <Dialog onClose={closePalette} className="ios-series-palette" role="dialog" aria-modal="true" aria-label="Question navigator">
          <button type="button" className="ios-series-palette-backdrop" onClick={closePalette} aria-label="Close navigator" />
          <div className="ios-series-palette-panel">
            <div className="ios-series-palette-title">
              <span>Questions</span>
              <button data-ui-button="state" data-ui-shape="icon" type="button" onClick={closePalette} aria-label="Close question navigator"><X /></button>
            </div>
            <div ref={gridRef} className="ios-series-palette-grid" style={large ? { display: 'block' } : undefined}>
              <div style={large ? { position: 'relative', height: grid.getTotalSize() } : { display: 'contents' }}>
              {(large ? grid.getVirtualItems().flatMap(row => questions.slice(row.index * 5, row.index * 5 + 5).map((question, column) => ({ question, index: row.index * 5 + column, start: row.start, column }))) : questions.map((question, index) => ({ question, index, start: 0, column: 0 }))).map(({ question, index, start, column }) => (
                <button data-ui-button="state"
                  key={`palette-${question.id}-${index}`}
                  type="button"
                  className={statusClass(getStatus(index))}
                  style={large ? { position: 'absolute', top: start, left: `calc(${column} * (100% + 10px) / 5)`, width: 'calc((100% - 40px) / 5)' } : undefined}
                  onClick={() => {
                    goToQuestion(index + 1);
                    closePalette();
                  }}
                  aria-label={`Go to question ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
              </div>
            {hasMore && (
              <div className="ios-series-palette-load-more">
                <button type="button" data-ui-button="secondary" disabled={isFetchingMore}
                  aria-busy={isFetchingMore} onClick={() => { void fetchMore(); }}>
                  {isFetchingMore ? "Loading…" : "Load more questions"}
                </button>
              </div>
            )}
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
