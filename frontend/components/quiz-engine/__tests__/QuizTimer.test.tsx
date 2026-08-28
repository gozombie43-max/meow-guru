import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QuizTimer, formatClock, QuizTimerRef } from '../QuizTimer';

describe('QuizTimer Component and formatClock Helper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly formats seconds into mm:ss strings', () => {
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(125)).toBe('2:05');
  });

  it('renders initial timer countdown', () => {
    render(<QuizTimer maxTime={60} />);
    expect(screen.getByText('1:00')).toBeDefined();
  });

  it('starts countdown and calls onExpire on reaching zero', () => {
    const onExpire = vi.fn();
    const ref = React.createRef<QuizTimerRef>();
    render(<QuizTimer maxTime={3} onExpire={onExpire} ref={ref} />);

    act(() => {
      ref.current?.start(3);
    });

    expect(ref.current?.getTimeLeft()).toBe(3);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(ref.current?.getTimeLeft()).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stops countdown correctly', () => {
    const ref = React.createRef<QuizTimerRef>();
    render(<QuizTimer maxTime={10} ref={ref} />);

    act(() => {
      ref.current?.start(10);
      vi.advanceTimersByTime(2000);
    });

    expect(ref.current?.getTimeLeft()).toBe(8);

    act(() => {
      ref.current?.stop();
      vi.advanceTimersByTime(3000);
    });

    expect(ref.current?.getTimeLeft()).toBe(8);
  });
});
