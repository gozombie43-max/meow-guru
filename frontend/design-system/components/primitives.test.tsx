import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FeedbackToast from '@/components/FeedbackToast';
import { announceFeedback } from '@/lib/feedback';
import { Badge, Button, Card, Spinner, Toast, ToastRegion } from './index';

const COMPONENTS_DIR = join(process.cwd(), 'design-system', 'components');
const GLOBALS_CSS = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
const BUTTON_CSS = readFileSync(join(COMPONENTS_DIR, 'Button.module.css'), 'utf8');
const CARD_CSS = readFileSync(join(COMPONENTS_DIR, 'Card.module.css'), 'utf8');
const BADGE_CSS = readFileSync(join(COMPONENTS_DIR, 'Badge.module.css'), 'utf8');
const SPINNER_CSS = readFileSync(join(COMPONENTS_DIR, 'Spinner.module.css'), 'utf8');
const TOAST_CSS = readFileSync(join(COMPONENTS_DIR, 'Toast.module.css'), 'utf8');

describe('Meow Design System Primitives (PR P0-B)', () => {
  describe('Button', () => {
    it('stamps clean data-ui-button attributes, forwards refs, and defaults type to button', () => {
      const ref = createRef<HTMLButtonElement>();
      const handleClick = vi.fn();

      render(
        <div>
          <Button ref={ref} variant="primary" onClick={handleClick}>
            Save changes
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete solid</Button>
          <Button variant="destructive" destructiveTone="subtle">
            Delete subtle
          </Button>
          <Button variant="secondary" size="icon" aria-label="Close panel">
            ×
          </Button>
          <Button variant="primary" size="icon" aria-label="Add item">
            +
          </Button>
        </div>,
      );

      const primary = screen.getByRole('button', { name: 'Save changes' });
      expect(ref.current).toBe(primary);
      expect(primary).toHaveAttribute('type', 'button');
      expect(primary).toHaveAttribute('data-ui-button', 'primary');
      expect(primary).toHaveAttribute('data-custom-focus', 'true');
      expect(primary).toHaveAttribute('data-meow-component', 'button');
      expect(primary).toHaveAttribute('data-meow-variant', 'primary');
      fireEvent.click(primary);
      expect(handleClick).toHaveBeenCalledTimes(1);

      expect(screen.getByRole('button', { name: 'Secondary' })).toHaveAttribute('data-ui-button', 'secondary');
      expect(screen.getByRole('button', { name: 'Ghost' })).toHaveAttribute('data-ui-button', 'state');
      expect(screen.getByRole('button', { name: 'Delete solid' })).toHaveAttribute('data-ui-button', 'danger');
      expect(screen.getByRole('button', { name: 'Delete subtle' })).toHaveAttribute('data-ui-button', 'state');

      const secondaryIcon = screen.getByRole('button', { name: 'Close panel' });
      expect(secondaryIcon).toHaveAttribute('data-ui-button', 'icon');
      expect(secondaryIcon).not.toHaveAttribute('data-ui-shape');

      const primaryIcon = screen.getByRole('button', { name: 'Add item' });
      expect(primaryIcon).toHaveAttribute('data-ui-button', 'primary');
      expect(primaryIcon).toHaveAttribute('data-ui-shape', 'icon');
    });

    it('renders loading state with aria-busy, preserved label geometry, and click suppression', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" loading onClick={handleClick}>
          Submitting
        </Button>,
      );

      const btn = screen.getByRole('button', { name: 'Submitting' });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
      expect(btn.querySelector('[data-meow-component="spinner"]')).toHaveAttribute('aria-hidden', 'true');

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('uses canonical --meow-* tokens, desktop-only small sizing, and clean focus ring CSS', () => {
      expect(BUTTON_CSS).toContain('--ui-action: var(--meow-action-fill)');
      expect(BUTTON_CSS).toContain('--ui-action: var(--meow-action-fill-hover)');
      expect(BUTTON_CSS).toContain('outline: 2px solid var(--meow-accent)');
      expect(BUTTON_CSS).toContain('@media (min-width: 1024px) and (pointer: fine)');
      expect(BUTTON_CSS).toContain('--ui-control-height: var(--meow-control-h-sm)');
      expect(BUTTON_CSS).toContain('box-shadow: none');
    });
  });

  describe('Card', () => {
    it('renders static containers cleanly and native buttons when interactive', () => {
      const handleSelect = vi.fn();
      render(
        <div>
          <Card as="section" padding="lg" variant="accent-outline" data-testid="static-card">
            Highlighted card
          </Card>
          <Card onClick={handleSelect} padding="sm">
            Clickable card
          </Card>
        </div>,
      );

      const staticCard = screen.getByTestId('static-card');
      expect(staticCard.tagName).toBe('SECTION');
      expect(staticCard).toHaveAttribute('data-meow-component', 'card');
      expect(staticCard).toHaveAttribute('data-meow-variant', 'accent-outline');
      expect(staticCard).toHaveAttribute('data-meow-padding', 'lg');

      const interactiveCard = screen.getByRole('button', { name: 'Clickable card' });
      expect(interactiveCard).toHaveAttribute('data-ui-button', 'state');
      expect(interactiveCard).toHaveAttribute('data-meow-variant', 'interactive');
      fireEvent.click(interactiveCard);
      expect(handleSelect).toHaveBeenCalledTimes(1);
    });

    it('avoids backdrop-filter glassmorphism and neon shadows in CSS', () => {
      expect(CARD_CSS).toContain('backdrop-filter: none');
      expect(CARD_CSS).toContain('var(--meow-surface)');
      expect(CARD_CSS).toContain('var(--meow-border)');
      expect(CARD_CSS).toContain('var(--meow-shadow-none)');
    });
  });

  describe('Badge & Spinner', () => {
    it('renders semantic Badge variants and optional icons cleanly', () => {
      render(
        <Badge variant="success" size="sm" icon={<span data-testid="badge-dot">*</span>}>
          Completed
        </Badge>,
      );

      const badge = screen.getByText('Completed').closest('[data-meow-component="badge"]');
      expect(badge).toHaveAttribute('data-meow-variant', 'success');
      expect(badge).toHaveAttribute('data-meow-size', 'sm');
      expect(screen.getByTestId('badge-dot').parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(BADGE_CSS).toContain('var(--meow-success-soft)');
      expect(BADGE_CSS).toContain('var(--meow-secondary)');
    });

    it('renders Spinner as decorative when embedded and polite status when standalone', () => {
      const { rerender } = render(<Spinner size="md" tone="accent" />);
      const decorative = document.querySelector('[data-meow-component="spinner"]');
      expect(decorative).toHaveAttribute('aria-hidden', 'true');
      expect(decorative).not.toHaveAttribute('role', 'status');

      rerender(<Spinner size="lg" tone="secondary" label="Loading questions" />);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Loading questions');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(SPINNER_CSS).toContain('meow-spin');
    });
  });

  describe('Toast & FeedbackToast', () => {
    it('renders Toast primitives and handles FeedbackToast custom events with timer cleanup', () => {
      vi.useFakeTimers();
      render(<FeedbackToast />);

      expect(screen.queryByRole('status')).toBeNull();

      act(() => {
        announceFeedback('Saved preference', 'success');
      });
      const firstToast = screen.getByRole('status');
      expect(firstToast).toHaveTextContent('Saved preference');
      expect(firstToast).toHaveAttribute('data-meow-tone', 'success');

      act(() => {
        vi.advanceTimersByTime(2000);
        announceFeedback('Could not sync attempt', 'error');
      });
      const errorToast = screen.getByRole('status');
      expect(errorToast).toHaveTextContent('Could not sync attempt');
      expect(errorToast).toHaveAttribute('data-meow-tone', 'error');

      // New toast resets the 3200ms expiry timeout rather than expiring early at 3200ms total.
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Could not sync attempt');

      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('renders ToastRegion live region explicitly', () => {
      render(
        <ToastRegion data-testid="region">
          <Toast tone="warning" message="Check connection" />
        </ToastRegion>,
      );

      expect(screen.getByTestId('region')).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('status')).toHaveAttribute('data-meow-tone', 'warning');
    });

    it('eliminates Nunito Sans and pairs --meow-font-sans across Toast and globals.css', () => {
      expect(GLOBALS_CSS).not.toContain('Nunito Sans');
      expect(TOAST_CSS).toContain('var(--meow-font-sans)');
      expect(TOAST_CSS).toContain('var(--meow-z-toast)');

      for (const css of [BUTTON_CSS, CARD_CSS, BADGE_CSS, SPINNER_CSS, TOAST_CSS]) {
        expect(css).not.toMatch(/\btransition\s*:\s*all\b/i);
        expect(css).not.toMatch(/\b100vh\b/i);
      }

      for (const animatedCss of [BUTTON_CSS, CARD_CSS, SPINNER_CSS, TOAST_CSS]) {
        expect(animatedCss).toContain('prefers-reduced-motion');
      }
    });
  });
});
