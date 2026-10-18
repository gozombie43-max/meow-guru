import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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

it('renders markdown images with raw github URLs in mock and pyq questions without KaTeX corruption', () => {
  const pyqText = 'AB রেখা বরাবর একটি আয়না রাখা হলে প্রশ্নচিত্রটির সঠিক প্রতিবিম্ব কোনটি? ![Question figure and options](https://raw.githubusercontent.com/meow-guru/gozombie43-max/main/frontend/public/pyq-assets/ssc-chsl-2025-11-14-shift-3-combined/r035.png)';
  const { container } = render(<RichContent text={pyqText} />);
  expect(screen.getByText(/AB রেখা বরাবর একটি আয়না রাখা হলে প্রশ্নচিত্রটির সঠিক প্রতিবিম্ব কোনটি\?/)).toBeInTheDocument();
  const img = screen.getByAltText('Question figure and options');
  expect(img).toBeInTheDocument();
  expect(img).toHaveAttribute('src', 'https://raw.githubusercontent.com/meow-guru/gozombie43-max/main/frontend/public/pyq-assets/ssc-chsl-2025-11-14-shift-3-combined/r035.png');
  expect(container.querySelectorAll('.katex')).toHaveLength(0);
});

it('renders standalone image URLs as images in rich content', () => {
  const standaloneUrl = 'Question figure https://raw.githubusercontent.com/meow-guru/gozombie43-max/main/frontend/public/pyq-assets/ssc-chsl-2025-11-14-shift-3-combined/r035.png';
  render(<RichContent text={standaloneUrl} />);
  expect(screen.getByText(/Question figure/)).toBeInTheDocument();
  const img = screen.getByAltText('Question image');
  expect(img).toBeInTheDocument();
  expect(img).toHaveAttribute('src', 'https://raw.githubusercontent.com/meow-guru/gozombie43-max/main/frontend/public/pyq-assets/ssc-chsl-2025-11-14-shift-3-combined/r035.png');
});

it('applies compact option container styling when isOption is set', () => {
  render(<QuestionImage src="/api/upload/image/opt" alt="Option diagram" isOption />);
  const img = screen.getByAltText('Option diagram');
  expect(img.parentElement?.className).toContain('optionContainer');
});

it('resets errors when the question image changes and retries without a probe request', () => {
  const probe = vi.spyOn(window, 'Image');
  try {
    const view = render(<QuestionImage src="https://legacy.example/first.png" alt="Figure" />);
    const first = screen.getByAltText('Figure');
    fireEvent.error(first);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load image');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByAltText('Figure')).not.toBe(first);
    fireEvent.error(screen.getByAltText('Figure'));
    view.rerender(<QuestionImage src="https://legacy.example/second.png" alt="Figure" />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  } finally {
    probe.mockRestore();
  }
});

it('focuses the enlarged view, closes with Escape and restores focus', async () => {
  render(<QuestionImage src="https://legacy.example/figure.png" alt="Diagram" />);
  const image = screen.getByAltText('Diagram');
  // jsdom does not load the CSS module that positions Next's fill container.
  image.parentElement!.style.position = 'relative';
  Object.defineProperty(image, 'height', { configurable: true, value: 300 });
  fireEvent.load(image);
  const enlarge = await screen.findByRole('button', { name: 'Enlarge image' });
  enlarge.focus();
  fireEvent.click(enlarge);
  expect(screen.getByRole('dialog', { name: 'Diagram' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close enlarged view' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(enlarge).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
});

it.each([
  '/api/upload/image/key',
  'https://legacy.example/api/upload/image/key',
  '/pyq-assets/figure.png',
  'https://legacy.example/figure.png?token=abc&v=2',
])('renders the complete standalone image path %s', src => {
  render(<RichContent text={`Figure ${src}.`} />);
  const image = screen.getByAltText('Question image');
  const actual = decodeURIComponent(image.getAttribute('src')!);
  expect(actual).toContain(resolveQuestionImage(src));
});

it('keeps ordinary links and filenames containing image extensions as text', () => {
  const text = 'Read https://example.com/figure.png.txt and https://example.com/docs.';
  const { container } = render(<RichContent text={text} />);
  expect(container.textContent).toBe(text);
  expect(screen.queryByRole('img')).toBeNull();
});

it('retains the query string on absolute upload URLs', () => {
  expect(resolveQuestionImage('https://example.com/api/upload/image/key?version=2')).toBe('/backend-api/api/upload/image/key?version=2');
  expect(resolveQuestionImage('  ')).toBe('');
});
