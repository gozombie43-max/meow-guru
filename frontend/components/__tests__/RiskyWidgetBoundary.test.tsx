import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RiskyWidgetBoundary from '../RiskyWidgetBoundary';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

let shouldThrow = true;

function FragileWidget() {
  if (shouldThrow) throw new Error('widget failed');
  return <div>Widget recovered</div>;
}

describe('RiskyWidgetBoundary', () => {
  afterEach(() => {
    shouldThrow = true;
    vi.restoreAllMocks();
  });

  it('reports a widget crash and lets the user retry it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RiskyWidgetBoundary label="AI response">
        <FragileWidget />
      </RiskyWidgetBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This AI response could not be displayed.');
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'widget failed' }),
      expect.objectContaining({ tags: { widget: 'AI response' } })
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Widget recovered')).toBeInTheDocument();
  });
});
