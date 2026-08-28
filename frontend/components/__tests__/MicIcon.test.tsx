import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MicIcon from '../MicIcon';

describe('MicIcon Component', () => {
  it('renders SVG with default size and attributes', () => {
    const { container } = render(<MicIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('18');
    expect(svg?.getAttribute('height')).toBe('18');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.querySelector('path')).not.toBeNull();
  });

  it('renders with custom size and className', () => {
    const { container } = render(<MicIcon size={24} className="custom-mic-class" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.classList.contains('custom-mic-class')).toBe(true);
  });
});
