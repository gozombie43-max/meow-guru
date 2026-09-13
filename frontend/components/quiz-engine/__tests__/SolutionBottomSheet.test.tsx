import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { SolutionBottomSheet } from '../ui/SolutionViews';
import { QuizThemeProvider } from '../QuizThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<QuizThemeProvider>{ui}</QuizThemeProvider>);
}

describe('SolutionBottomSheet Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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
    expect(screen.getByRole('button', { name: /Close solution/i })).toBeInTheDocument();
  });

  it('calls onClose when Done button is clicked', () => {
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

    const doneBtn = screen.getByRole('button', { name: /Close solution/i });
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
