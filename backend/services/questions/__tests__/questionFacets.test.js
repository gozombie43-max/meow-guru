import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const aggregateMock = vi.fn();
vi.mock('../../../config/mongodb.js', () => ({
  getQuestionsCollection: () => ({
    aggregate: aggregateMock,
  }),
}));

import { invalidateQuestionCacheRevision } from '../questionCache.js';
import { readQuestionFacets } from '../questionFacets.js';
import { buildExcludeStudyModeCondition } from '../questionQueryBuilder.js';

describe('readQuestionFacets', () => {
  beforeEach(() => {
    aggregateMock.mockReset();
    invalidateQuestionCacheRevision();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    invalidateQuestionCacheRevision();
  });

  it('aggregates all questions when no subject is specified (normalized keys enabled by default)', async () => {
    aggregateMock.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { topics: ['algebra', 'analogy'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
      ]),
    });

    const result = await readQuestionFacets();
    expect(result.topics).toEqual(['algebra', 'analogy']);

    const pipeline = aggregateMock.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({ modeKey: { $ne: 'studyMode' } });
  });

  it('scopes aggregation to mathematics when subject is mathematics (normalized keys enabled by default)', async () => {
    aggregateMock.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { topics: ['algebra', 'geometry'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
      ]),
    });

    const result = await readQuestionFacets('mathematics');
    expect(result.topics).toEqual(['algebra', 'geometry']);

    const pipeline = aggregateMock.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({
      $and: [
        { modeKey: { $ne: 'studyMode' } },
        { subjectKey: 'mathematics' },
      ],
    });
  });

  it('supports reasoning subject matching both reasoning and logicalreasoning keys', async () => {
    aggregateMock.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { topics: ['analogy', 'blood-relations'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
      ]),
    });

    const result = await readQuestionFacets('reasoning');
    expect(result.topics).toEqual(['analogy', 'blood-relations']);

    const pipeline = aggregateMock.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({
      $and: [
        { modeKey: { $ne: 'studyMode' } },
        { subjectKey: { $in: ['reasoning', 'logicalreasoning'] } },
      ],
    });
  });

  it('falls back to legacy $nor and RegExp predicates when QUESTIONS_NORMALIZED_KEYS=false', async () => {
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'false');
    aggregateMock.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { topics: ['algebra', 'geometry'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
      ]),
    });

    await readQuestionFacets();
    expect(aggregateMock.mock.calls[0][0][0].$match).toEqual(buildExcludeStudyModeCondition());

    invalidateQuestionCacheRevision();
    await readQuestionFacets('mathematics');
    const mathMatch = aggregateMock.mock.calls[1][0][0].$match;
    expect(mathMatch).toEqual({
      $and: [
        buildExcludeStudyModeCondition(),
        { subject: expect.any(RegExp) },
      ],
    });
    expect(mathMatch.$and[1].subject.test('mathematics')).toBe(true);
    expect(mathMatch.$and[1].subject.test('reasoning')).toBe(false);

    invalidateQuestionCacheRevision();
    await readQuestionFacets('reasoning');
    const reasoningCond = aggregateMock.mock.calls[2][0][0].$match.$and[1].subject;
    expect(reasoningCond.$in).toBeDefined();
    expect(reasoningCond.$in.some(re => re.test('reasoning'))).toBe(true);
    expect(reasoningCond.$in.some(re => re.test('logical reasoning'))).toBe(true);
    expect(reasoningCond.$in.some(re => re.test('mathematics'))).toBe(false);
  });

  it('caches facets separately for different subjects', async () => {
    aggregateMock.mockReturnValueOnce({
      toArray: vi.fn().mockResolvedValue([{ topics: ['algebra'] }]),
    }).mockReturnValueOnce({
      toArray: vi.fn().mockResolvedValue([{ topics: ['analogy'] }]),
    });

    const mathResult1 = await readQuestionFacets('mathematics');
    const mathResult2 = await readQuestionFacets('mathematics');
    expect(aggregateMock).toHaveBeenCalledTimes(1);
    expect(mathResult1.topics).toEqual(['algebra']);
    expect(mathResult2.topics).toEqual(['algebra']);

    const reasoningResult = await readQuestionFacets('reasoning');
    expect(aggregateMock).toHaveBeenCalledTimes(2);
    expect(reasoningResult.topics).toEqual(['analogy']);
  });
});
