import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MathText from '../MathText';

describe('MathText Component', () => {
  it('renders an empty span when text is empty', () => {
    const { container } = render(<MathText text="" className="custom-class" />);
    const span = container.querySelector('span.custom-class');
    expect(span).not.toBeNull();
  });

  it('renders text with fraction layout elements', () => {
    const { container } = render(<MathText text="Value is 7/8 in lowest terms" />);
    const mathRole = container.querySelector('[role="math"]');
    expect(mathRole).not.toBeNull();
  });

  it('renders fraction with percentage sign', () => {
    render(<MathText text="Rate is 1/2%" />);
    expect(screen.getByText('%')).toBeDefined();
  });
});
