import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import QuestionImage, { resolveQuestionImage } from '../QuestionImage';
import RichContent from '../RichContent';

it('reserves the stored ratio and delivers responsive variants for stable storage images', () => {
  render(<QuestionImage src="/api/upload/image/key" alt="Question figure" width={1200} height={800} critical />);
  const img = screen.getByAltText('Question figure');
  expect(img.parentElement).toHaveStyle({ aspectRatio: '1200 / 800' });
  expect(img).toHaveAttribute('loading', 'eager');
  expect(img).toHaveAttribute('fetchpriority', 'high');
  expect(img.getAttribute('srcset')).toContain('/_next/image?');
  expect(img.getAttribute('sizes')).toContain('100vw');
  expect(resolveQuestionImage('/backend-api/api/upload/image/key')).toBe('/backend-api/api/upload/image/key');
});
it('uses one resolver for markdown images that already have a backend prefix', () => {
  render(<RichContent text="![Stored figure](/backend-api/api/upload/image/key)" />);
  const img = screen.getByAltText('Stored figure');
  expect(decodeURIComponent(img.getAttribute('src')!)).not.toContain('/backend-api/backend-api');
  expect(resolveQuestionImage('//legacy.example/figure.png')).toBe('https://legacy.example/figure.png');
});
it('reserves a stable contain frame for old records and keeps unknown external hosts usable', () => {
  render(<QuestionImage src="https://legacy.example/figure.png" alt="Legacy figure" />);
  const img = screen.getByAltText('Legacy figure');
  expect(img.parentElement).toHaveStyle({ aspectRatio: '4 / 3' });
  expect(img).toHaveStyle({ objectFit: 'contain' });
  expect(img).toHaveAttribute('loading', 'lazy');
  expect(img).toHaveAttribute('src', 'https://legacy.example/figure.png');
});
