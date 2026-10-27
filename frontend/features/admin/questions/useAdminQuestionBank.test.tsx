import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAdminQuestionBank } from './useAdminQuestionBank';
const fetch = vi.hoisted(() => vi.fn());
vi.mock('@/features/quiz/api/questionWrites', () => ({ questionWriteResponse: fetch }));
vi.mock('@/shared/api/client', () => ({ getAccessToken: () => null }));
vi.mock('./useQuestionUploads', () => ({ useQuestionUploads: () => ({}) }));
beforeEach(() => fetch.mockReset());

it('pages on the server and resets to page one for a debounced search', async () => {
  fetch.mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    return { ok: true, json: async () => ({
      questions: [{ id: params.get('cursor') === 'page-two' ? 'q51' : 'q1' }], count: 123, total: 123, nextCursor: 'page-two', prevCursor: 'page-one',
      facets: { topics: ['algebra', 'geometry'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
    }) };
  });
  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('q1'));
  expect(result.current.totalPages).toBe(3);
  expect(result.current.totalCount).toBe(123);
  expect(fetch.mock.calls[0][0]).toContain('limit=50');
  act(() => result.current.setPage(2));
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('q51'));
  expect(result.current.paginated).toHaveLength(1);
  act(() => { result.current.setSearch('equation'); result.current.setSortOrder('desc'); });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  const query = new URL(fetch.mock.calls[2][0], 'http://localhost').searchParams;
  expect(query.has('offset')).toBe(false);
  expect(query.get('pagination')).toBe('cursor');
  expect(query.has('cursor')).toBe(false);
  expect(query.get('search')).toBe('equation');
  expect(query.get('sort')).toBe('desc');
  expect(result.current.topics).toEqual(['algebra', 'geometry']);
});

it('filters out reasoning and english topics when subject is mathematics, and resets invalid topic', async () => {
  fetch.mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const subject = params.get('subject');
    return {
      ok: true,
      json: async () => ({
        questions: [{ id: 'q1', subject: subject || 'all' }],
        count: 10,
        total: 10,
        facets: {
          topics: subject === 'mathematics'
            ? ['algebra', 'geometry']
            : ['algebra', 'analogy', 'blood-relations', 'geometry', 'synonyms-antonyms'],
          exams: ['SSC CGL'],
          quizNames: ['PYQ'],
        },
      }),
    };
  });

  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('q1'));

  // Initial load without subject filter shows all topics
  expect(result.current.topics).toEqual([
    'algebra',
    'analogy',
    'blood-relations',
    'geometry',
    'synonyms-antonyms',
  ]);

  // Select a reasoning topic first
  act(() => {
    result.current.setFilterTopic('analogy');
  });
  expect(result.current.filterTopic).toBe('analogy');

  // Change subject to mathematics: topic should automatically reset because analogy is not a math topic
  act(() => {
    result.current.setFilterSubject('mathematics');
  });

  expect(result.current.filterSubject).toBe('mathematics');
  expect(result.current.filterTopic).toBe('');

  // topics should now only include mathematics topics, excluding analogy, blood-relations, synonyms-antonyms
  expect(result.current.topics).toEqual(['algebra', 'geometry']);

  // Verify fetch was called with subject=mathematics
  await waitFor(() => {
    const latestCall = fetch.mock.calls.at(-1)?.[0];
    const query = new URL(latestCall, 'http://localhost').searchParams;
    expect(query.get('subject')).toBe('mathematics');
  });
});


it('downloads matching questions as NDJSON using active subject, topic, quizName and examMode filters', async () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fetch.mockImplementation(async (url: string) => {
    if (String(url || '').includes('/api/questions/export')) {
      return {
        ok: true,
        text: async () =>
          '{"id":"algebra_001","subject":"mathematics","topic":"algebra"}\n{"id":"algebra_002","subject":"mathematics","topic":"algebra"}\n',
      };
    }
    return {
      ok: true,
      json: async () => ({
        questions: [{ id: 'algebra_001', subject: 'mathematics', topic: 'algebra' }],
        count: 2,
        total: 2,
        facets: { topics: ['algebra'], exams: ['SSC CGL'], quizNames: ['Concept Drill'] },
      }),
    };
  });

  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('algebra_001'));

  act(() => {
    result.current.setFilterSubject('mathematics');
    result.current.setFilterTopic('algebra');
    result.current.setFilterQuizName('Concept Drill');
  });

  await act(async () => {
    await result.current.handleDownloadNdjson();
  });

  const exportCall = fetch.mock.calls.find((call) => String(call[0] || '').includes('/api/questions/export'))?.[0];
  expect(exportCall).toBeDefined();
  const exportQuery = new URL(exportCall, 'http://localhost').searchParams;
  expect(exportQuery.get('examMode')).toBe('ssc');
  expect(exportQuery.get('subject')).toBe('mathematics');
  expect(exportQuery.get('topic')).toBe('algebra');
  expect(exportQuery.get('quizName')).toBe('Concept Drill');
  expect(result.current.success).toContain('Downloaded 2 questions');
  expect(clickSpy).toHaveBeenCalledTimes(1);
  clickSpy.mockRestore();
});

it('selects all matching topic questions across pages and deletes them in batches', async () => {
  const allTopicIds = Array.from({ length: 120 }, (_, i) => `econ_${i + 1}`);
  fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url || '').includes('/api/questions/export')) {
      return {
        ok: true,
        json: async () => ({
          count: allTopicIds.length,
          ids: allTopicIds,
          questions: allTopicIds.map((id) => ({ id })),
        }),
      };
    }
    if (String(url || '').includes('/api/questions/bulk-delete')) {
      const body = JSON.parse(String(init?.body || '{}'));
      return {
        ok: true,
        json: async () => ({ deleted: body.ids?.length || 0, failed: 0 }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        questions: allTopicIds.slice(0, 50).map((id) => ({ id, subject: 'general-awareness', topic: 'basics-of-economics' })),
        count: 50,
        total: 120,
        facets: { topics: ['basics-of-economics'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
      }),
    };
  });

  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions).toHaveLength(50));

  act(() => {
    result.current.setFilterSubject('general-awareness');
    result.current.setFilterTopic('basics-of-economics');
  });

  await act(async () => {
    await result.current.selectAllMatching();
  });

  expect(result.current.selected.size).toBe(120);
  expect(result.current.allMatchingSelected).toBe(true);

  await act(async () => {
    await result.current.handleBulkDelete();
  });

  const bulkDeleteCalls = fetch.mock.calls.filter((call) => String(call[0] || '').includes('/api/questions/bulk-delete'));
  expect(bulkDeleteCalls).toHaveLength(2);
  expect(result.current.selected.size).toBe(0);
  expect(result.current.success).toContain('Deleted 120 questions');
});

it('shows canonical GA topics and topic-specific chapters when General Awareness is selected', async () => {
  fetch.mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    return {
      ok: true,
      json: async () => ({
        questions: [
          {
            id: 'ga_chem_1',
            subject: 'general-awareness',
            topic: params.get('chapter') || 'Acids, Bases and Salts',
            chapter: params.get('chapter') || 'Acids, Bases and Salts',
          },
        ],
        count: 1,
        total: 1,
        facets: {
          topics: ['Acids, Bases and Salts', 'Advent of Europeans', 'Animal Kingdom'],
          exams: ['SSC CGL'],
          quizNames: ['PYQ'],
        },
      }),
    };
  });

  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('ga_chem_1'));

  act(() => {
    result.current.setFilterSubject('general-awareness');
  });

  // Top-level topics should be the 11 canonical GA topics, not the 192 chapter names
  expect(result.current.topics).toContain('chemistry');
  expect(result.current.topics).toContain('modern-history');
  expect(result.current.topics).not.toContain('Acids, Bases and Salts');
  expect(result.current.chapters).toEqual([]);

  // Select Chemistry topic -> chapters for Chemistry populate
  act(() => {
    result.current.setFilterTopic('chemistry');
  });

  expect(result.current.filterChapter).toBe('');
  expect(result.current.chapters.map((c) => c.value)).toContain('Acids, Bases and Salts');

  // Select a specific chapter -> fetchQuestions passes both topic=chemistry and chapter=Acids, Bases and Salts
  act(() => {
    result.current.setFilterChapter('Acids, Bases and Salts');
  });

  await waitFor(() => {
    const latestCall = fetch.mock.calls.at(-1)?.[0];
    const query = new URL(latestCall, 'http://localhost').searchParams;
    expect(query.get('subject')).toBe('general-awareness');
    expect(query.get('topic')).toBe('chemistry');
    expect(query.get('chapter')).toBe('Acids, Bases and Salts');
  });

  // Changing topic resets filterChapter
  act(() => {
    result.current.setFilterTopic('biology');
  });
  expect(result.current.filterChapter).toBe('');
  expect(result.current.chapters.map((c) => c.value)).toContain('Animal Kingdom');
});
