import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { SolutionBottomSheet } from '@/features/quiz/components/ui/SolutionViews';
import { QuizThemeProvider } from '@/features/quiz/components/QuizThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <QuizThemeProvider storageKey="solution-bottom-sheet-test-theme">
      {ui}
    </QuizThemeProvider>
  );
}

describe('SolutionBottomSheet Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps focus and scroll locked through exit, then restores the trigger', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Solution</button>
        <SolutionBottomSheet isOpen={open} solution="Explanation" questionNumber={1}
          correctOptionIndex={0} correctOptionText="A" onClose={() => setOpen(false)} />
      </>;
    }
    const overflow = document.body.style.overflow;
    renderWithTheme(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Solution' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Back to quiz' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(trigger).not.toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe(overflow);
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('keeps a rapidly reopened sheet active and releases the lock on unmount', () => {
    const props = { solution: 'Explanation', questionNumber: 1, correctOptionIndex: 0,
      correctOptionText: 'A', onClose: mockOnClose };
    const overflow = document.body.style.overflow;
    const view = renderWithTheme(<SolutionBottomSheet {...props} isOpen />);
    view.rerender(<QuizThemeProvider storageKey="solution-bottom-sheet-test-theme">
      <SolutionBottomSheet {...props} isOpen={false} />
    </QuizThemeProvider>);
    view.rerender(<QuizThemeProvider storageKey="solution-bottom-sheet-test-theme">
      <SolutionBottomSheet {...props} isOpen />
    </QuizThemeProvider>);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe(overflow);
  });

  it('renders worked solution modal when open', () => {
    renderWithTheme(
      <SolutionBottomSheet
        isOpen={true}
        solution="Step 1: Calculate the pattern. $2809 = 53^2$."
        questionNumber={1}
        correctOptionIndex={2}
        correctOptionText="32"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Worked Solution')).toBeInTheDocument();
    expect(screen.getByText(/Option \(C\) is correct/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to quiz/i })).toBeInTheDocument();
  });

  it('calls onClose when Back button is clicked', () => {
    renderWithTheme(
      <SolutionBottomSheet
        isOpen={true}
        solution="Solution explanation"
        questionNumber={1}
        correctOptionIndex={0}
        correctOptionText="Option A text"
        onClose={mockOnClose}
      />
    );

    const doneBtn = screen.getByRole('button', { name: /Back to quiz/i });
    fireEvent.click(doneBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when holding down on header drag zone', () => {
    vi.useFakeTimers();

    renderWithTheme(
      <SolutionBottomSheet
        isOpen={true}
        solution="Solution explanation"
        questionNumber={1}
        correctOptionIndex={0}
        correctOptionText="Option A text"
        onClose={mockOnClose}
      />
    );

    const dragZone = screen.getByTitle('Hold or drag down to close');
    expect(dragZone).toBeInTheDocument();

    // Trigger pointer down (hold)
    fireEvent.pointerDown(dragZone, { clientY: 100, button: 0 });

    // Fast-forward hold timer (450ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('closes modal when dragging down on header past threshold', () => {
    vi.useFakeTimers();

    renderWithTheme(
      <SolutionBottomSheet
        isOpen={true}
        solution="Solution explanation"
        questionNumber={1}
        correctOptionIndex={0}
        correctOptionText="Option A text"
        onClose={mockOnClose}
      />
    );

    const dragZone = screen.getByTitle('Hold or drag down to close');

    // Pointer down at y=100
    fireEvent.pointerDown(dragZone, { clientY: 100, button: 0 });

    // Drag down to y=200 (deltaY = 100 > 70 threshold)
    fireEvent.pointerMove(dragZone, { clientY: 200 });

    // Pointer up
    fireEvent.pointerUp(dragZone, { clientY: 200 });

    expect(mockOnClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
