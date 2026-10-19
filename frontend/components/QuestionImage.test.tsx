import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import QuestionImage from './QuestionImage';

it('loads B2 redirect URLs directly instead of sending them through the image optimizer', () => {
  render(<QuestionImage src="/api/upload/image/cXVlc3Rpb24taW1hZ2VzL3BhcGVyL3Eud2VicA" alt="Reasoning figure" width={120} height={100} />);
  const image = screen.getByRole('img', { name: 'Reasoning figure' });
  expect(new URL(image.getAttribute('src')!, window.location.href).pathname).toBe('/backend-api/api/upload/image/cXVlc3Rpb24taW1hZ2VzL3BhcGVyL3Eud2VicA');
  expect(image).not.toHaveAttribute('srcset');
});

it('retains optimization for static app images', () => {
  render(<QuestionImage src="/images/figure.webp" alt="Static figure" width={120} height={100} />);
  expect(new URL(screen.getByRole('img', { name: 'Static figure' }).getAttribute('src')!, window.location.href).pathname).toBe('/_next/image');
});
