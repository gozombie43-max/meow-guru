import { expect, it } from 'vitest';
import { comparePaperDateAndShift, paperDateLabel, type DatedPaper } from './paper-order';

it('sorts saved dates and numeric shifts before display order', () => {
  const papers: DatedPaper[] = [
    { id: 'later', title: 'Later', examDate: '2025-11-28', shift: 1, order: 1 },
    { id: 'shift10', title: 'Shift 10', examDate: '2025-11-12', shift: '10', order: 1 },
    { id: 'shift2', title: 'Shift 2', examDate: '2025-11-12', shift: 'Shift 2', order: 5 },
    { id: 'previous', title: 'Previous', examDate: '2024-01-01', shift: 1 },
    { id: 'shift1', title: 'Shift 1', examDate: '2025-11-12T23:00:00-05:00', shift: 1, order: 99 },
    { id: 'undated', title: 'No date', year: 2025, shift: 1 },
  ];
  expect(papers.sort(comparePaperDateAndShift).map(paper => paper.id)).toEqual(['shift1', 'shift2', 'shift10', 'later', 'undated', 'previous']);
  expect(paperDateLabel(papers[0])).toBe('12 Nov 2025');
});

it('retains legacy date ordering after a rename by falling back to the paper ID', () => {
  const papers = [
    { id: 'chsl-pyq-2025-29 nov', title: 'Renamed Shift 2', year: 2025 },
    { id: 'chsl-pyq-2025-12 nov', title: 'Renamed Shift 3', year: 2025 },
    { id: 'older-title', title: '13 November 2025 (SHIFT 1)' },
  ];
  expect(papers.sort(comparePaperDateAndShift).map(paper => paper.id)).toEqual(['chsl-pyq-2025-12 nov', 'older-title', 'chsl-pyq-2025-29 nov']);
  expect(paperDateLabel(papers[0])).toBe('12 Nov 2025');
});

it('does not invent dates and breaks ties deterministically', () => {
  expect(paperDateLabel({ id: 'invalid', title: '31 February 2025' })).toBe('2025');
  expect(paperDateLabel({ id: 'none', title: 'No date' })).toBe('—');
  expect(comparePaperDateAndShift({ id: 'paper-2', title: '' }, { id: 'paper-10', title: '' })).toBeLessThan(0);
});
