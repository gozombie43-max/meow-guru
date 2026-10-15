import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BattleQuestionCard from './BattleQuestionCard';
vi.mock('@/components/RichContent', () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
vi.mock('@/components/QuestionImage', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} /> }));
const question = { question: 'Pick primes', options: ['2', '3', '4', '5'], questionIndex: 0, total: 10, deadline: null };
it('lets MSQ choices change before sending one discriminated answer', () => {
  const onSubmit = vi.fn();
  render(<BattleQuestionCard question={{ ...question, type: 'msq', questionImage: '/q.png', optionImages: ['/a.png'] }} answer={null} reveal={null} userId="me" disabled={false} onSubmit={onSubmit} />);
  const choices = screen.getAllByRole('button', { pressed: false });
  fireEvent.click(choices[0]); fireEvent.click(choices[2]); fireEvent.click(choices[2]); fireEvent.click(choices[1]);
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Lock answer' }));
  expect(onSubmit).toHaveBeenCalledWith({ type: 'msq', selectedIndices: [0, 1] });
  expect(screen.getByRole('img', { name: 'Question diagram' })).toHaveAttribute('data-src', '/q.png');
  expect(screen.getByRole('img', { name: 'Option A diagram' })).toHaveAttribute('data-src', '/a.png');
});
it('requires a finite nonempty NAT input and preserves zero and negative decimals', () => {
  const onSubmit = vi.fn();
  const { rerender } = render(<BattleQuestionCard question={{ ...question, type: 'nat', options: [] }} answer={null} reveal={null} userId="me" disabled={false} onSubmit={onSubmit} />);
  const submit = screen.getByRole('button', { name: 'Lock answer' }), input = screen.getByRole('textbox');
  expect(submit).toBeDisabled(); fireEvent.change(input, { target: { value: 'Infinity' } }); expect(submit).toBeDisabled();
  fireEvent.change(input, { target: { value: '0' } }); fireEvent.click(submit); expect(onSubmit).toHaveBeenLastCalledWith({ type: 'nat', numericAnswer: 0 });
  fireEvent.change(input, { target: { value: '-2.5' } }); fireEvent.click(submit); expect(onSubmit).toHaveBeenLastCalledWith({ type: 'nat', numericAnswer: -2.5 });
  rerender(<BattleQuestionCard question={{ ...question, type: 'nat', options: [] }} answer={{ type: 'nat', numericAnswer: -2.5 }} reveal={null} userId="me" disabled onSubmit={onSubmit} />);
  expect(input).toBeDisabled(); expect(input).toHaveValue('-2.5');
});
