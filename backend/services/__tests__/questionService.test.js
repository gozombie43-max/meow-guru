import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuestionsCollectionMock } = vi.hoisted(() => ({
  getQuestionsCollectionMock: vi.fn(),
}));

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: getQuestionsCollectionMock,
}));

import {
  analyzeAnswers,
  checkDuplicates,
  createQuestion,
  createQuestionsBulk,
  fetchImageQuestions,
  fetchPracticeTest,
  fetchQuestionById,
  fetchQuestions,
  normalizeSearchKey,
  normalizeQuizKey,
  matchesNormalizedTopic,
  modifyQuestion,
  isStudyModeRecord,
  buildQuestionsCacheKey,
  questionsQueryCache,
  removeQuestion,
  removeQuestionsBulk,
} from '../questionService.js';

function createCursor(resources) {
  const cursor = {
    project: vi.fn(() => cursor),
    limit: vi.fn(() => cursor),
    toArray: vi.fn(async () => resources),
  };
  return cursor;
}

beforeEach(() => {
  vi.clearAllMocks();
  questionsQueryCache.clear();
});

describe('Question Service Helpers', () => {
  it('normalizes search keys by trimming and removing punctuation', () => {
    expect(normalizeSearchKey('  Profit & Loss! ')).toBe('profitloss');
    expect(normalizeSearchKey('Time-and-Distance')).toBe('timeanddistance');
    expect(normalizeSearchKey(null)).toBe('');
  });

  it('normalizes quiz keys accurately', () => {
    expect(normalizeQuizKey('SSC CGL 2023 - Shift 1')).toBe('ssccgl2023shift1');
  });

  it('matches normalized topic candidates across question fields', () => {
    const question = {
      subject: 'Mathematics',
      chapter: 'Percentages',
      topic: 'percentages',
      quizTopic: 'percentages',
    };

    expect(matchesNormalizedTopic(question, 'percentages')).toBe(true);
    expect(matchesNormalizedTopic(question, 'algebra')).toBe(false);
  });

  it('handles synonyms and antonyms aliasing in matchesNormalizedTopic', () => {
    const question = {
      subject: 'English',
      chapter: 'Antonyms',
      topic: 'antonyms',
    };

    expect(matchesNormalizedTopic(question, 'synonymsantonyms')).toBe(true);
  });

  it('identifies study mode vocabulary records', () => {
    expect(isStudyModeRecord({ questionType: 'study-mode' })).toBe(true);
    expect(isStudyModeRecord({ quizName: 'Study Mode' })).toBe(true);
    expect(isStudyModeRecord({ word: 'Benevolent', meanings: ['Kind'] })).toBe(true);
    expect(isStudyModeRecord({ question: 'Regular MCQ Question', options: ['A', 'B'] })).toBe(false);
    expect(isStudyModeRecord(null)).toBe(false);
  });

  it('builds deterministic question cache keys', () => {
    const params = [
      { name: '@subject', value: 'mathematics' },
      { name: '@difficulty', value: 'medium' },
    ];
    const key1 = buildQuestionsCacheKey(params, 0, 20);
    const key2 = buildQuestionsCacheKey(params, 0, 20);
    expect(key1).toBe(key2);
    expect(typeof key1).toBe('string');
  });
});

describe('MongoDB-backed question reads', () => {
  it('fetches image questions without exposing MongoDB _id values', async () => {
    const cursor = createCursor([{ id: 'image-1', topic: 'visual_reasoning' }]);
    const collection = { find: vi.fn(() => cursor) };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await fetchImageQuestions('visual_reasoning', '5');

    expect(collection.find).toHaveBeenCalledWith({
      questionType: 'image_mcq',
      topic: 'visual_reasoning',
    });
    expect(cursor.project).toHaveBeenCalledWith({ _id: 0 });
    expect(cursor.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      count: 1,
      questions: [{ id: 'image-1', topic: 'visual_reasoning' }],
    });
  });

  it('preserves topic fallback, quiz-name, study-mode, and pagination behavior', async () => {
    const directCursor = createCursor([]);
    const fallbackCursor = createCursor([
      { id: 'regular', chapter: 'Profit & Loss', source: 'PYQ', question: 'Regular' },
      { id: 'study', chapter: 'Profit & Loss', source: 'PYQ', questionType: 'study-mode' },
      {
        id: 'other-quiz',
        chapter: 'Profit & Loss',
        quizName: 'Practice',
        source: 'Practice',
        question: 'Other',
      },
    ]);
    const collection = {
      find: vi.fn()
        .mockReturnValueOnce(directCursor)
        .mockReturnValueOnce(fallbackCursor),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await fetchQuestions({
      topic: 'Profit & Loss',
      quizName: 'PYQ',
      offset: 0,
      limit: 10,
    });

    expect(collection.find).toHaveBeenCalledTimes(2);
    expect(fallbackCursor.project).toHaveBeenCalledWith({ _id: 0 });
    expect(result).toEqual({
      count: 1,
      questions: [
        { id: 'regular', chapter: 'Profit & Loss', source: 'PYQ', question: 'Regular' },
      ],
    });
  });

  it('builds a case-insensitive practice filter and returns the public shape', async () => {
    const cursor = createCursor([
      {
        id: 'q-1',
        subject: 'Mathematics',
        chapter: 'Algebra',
        concept: 'Linear equations',
        question: 'Solve x + 1 = 2',
        options: ['0', '1'],
        difficulty: 'Medium',
        correctAnswer: '1',
      },
      { id: 'study', subject: 'Mathematics', questionType: 'study-mode' },
    ]);
    const collection = { find: vi.fn(() => cursor) };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await fetchPracticeTest({
      subject: 'mathematics',
      difficulty: 'medium',
      count: 2,
    });

    const filter = collection.find.mock.calls[0][0];
    expect(filter.$and[0].subject.test('Mathematics')).toBe(true);
    expect(filter.$and[1].difficulty.test('Medium')).toBe(true);
    expect(cursor.limit).toHaveBeenCalledWith(6);
    expect(result).toEqual([
      {
        id: 'q-1',
        subject: 'Mathematics',
        chapter: 'Algebra',
        concept: 'Linear equations',
        question: 'Solve x + 1 = 2',
        options: ['0', '1'],
        difficulty: 'Medium',
      },
    ]);
  });

  it('analyzes answers from MongoDB and supports topic-aware identity', async () => {
    const cursor = createCursor([
      {
        id: 'shared-id',
        topic: 'algebra',
        subject: 'Mathematics',
        correctAnswer: 'A',
      },
      {
        id: 'shared-id',
        topic: 'geometry',
        subject: 'Geometry',
        correctAnswer: 'B',
      },
      {
        id: 'unknown-subject',
        correctAnswer: 'C',
      },
    ]);
    const collection = { find: vi.fn(() => cursor) };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await analyzeAnswers([
      { questionId: 'shared-id', topic: 'geometry', selectedAnswer: 'B' },
      { questionId: 'unknown-subject', selectedAnswer: null },
    ]);

    expect(collection.find).toHaveBeenCalledWith({
      id: { $in: ['shared-id', 'unknown-subject'] },
    });
    expect(cursor.project).toHaveBeenCalledWith({ _id: 0 });
    expect(result).toEqual({
      summary: {
        totalQuestions: 2,
        correct: 1,
        incorrect: 0,
        unattempted: 1,
        scorePercent: 50,
      },
      subjectBreakdown: {
        Geometry: { correct: 1, incorrect: 0, unattempted: 0, total: 1 },
        Unknown: { correct: 0, incorrect: 0, unattempted: 1, total: 1 },
      },
      details: [
        { questionId: 'shared-id', status: 'correct' },
        { questionId: 'unknown-subject', status: 'unattempted' },
      ],
    });
  });

  it('fetches a question by id and optional topic without exposing _id', async () => {
    const question = { id: 'q457', topic: 'algebra', question: 'Example' };
    const collection = { findOne: vi.fn(async () => question) };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(fetchQuestionById('q457', 'algebra')).resolves.toEqual(question);
    expect(collection.findOne).toHaveBeenCalledWith(
      { id: 'q457', topic: 'algebra' },
      { projection: { _id: 0 } }
    );
  });

  it('detects duplicate ids before duplicate question text using MongoDB', async () => {
    const idCursor = createCursor([{ id: 'existing-id', question: 'Stored by id' }]);
    const textCursor = createCursor([{ id: 'matched-text-id', question: 'Same question' }]);
    const collection = {
      find: vi.fn()
        .mockReturnValueOnce(idCursor)
        .mockReturnValueOnce(textCursor),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await checkDuplicates([
      { id: 'existing-id', question: 'Same question' },
      { id: 'new-id', questionText: 'Same question' },
      { id: 'unique-id', question: 'Unique question' },
    ]);

    expect(collection.find).toHaveBeenNthCalledWith(1, {
      id: { $in: ['existing-id', 'new-id', 'unique-id'] },
    });
    expect(collection.find).toHaveBeenNthCalledWith(2, {
      $or: [
        { question: { $in: ['Same question', 'Unique question'] } },
        { questionText: { $in: ['Same question', 'Unique question'] } },
      ],
    });
    expect(result).toEqual([
      { index: 0, id: 'existing-id', reason: 'Duplicate ID' },
      {
        index: 1,
        id: 'new-id',
        matchedId: 'matched-text-id',
        reason: 'Duplicate Question Text',
      },
    ]);
  });
});

describe('MongoDB-backed question writes', () => {
  it('creates a normalized question, clears cache, and hides _id', async () => {
    const collection = {
      insertOne: vi.fn(async (item) => {
        item._id = 'mongo-id';
        return { insertedId: 'mongo-id' };
      }),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);
    questionsQueryCache.set('stale', ['cached']);

    const result = await createQuestion({ id: 'new-id', chapter: ' Algebra ' });

    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-id', topic: 'Algebra' })
    );
    expect(result).toEqual({ id: 'new-id', chapter: ' Algebra ', topic: 'Algebra' });
    expect(questionsQueryCache.has('stale')).toBe(false);
  });

  it('bulk creates with Promise.allSettled results and retries duplicate ids', async () => {
    const collection = {
      insertOne: vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000 }))
        .mockResolvedValue({ acknowledged: true }),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const results = await createQuestionsBulk([
      { id: 'duplicate-id', quizSubject: 'English', quizTopic: 'Vocabulary' },
    ]);

    expect(collection.insertOne).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('fulfilled');
    expect(results[0].value).toEqual(
      expect.objectContaining({
        subject: 'English',
        chapter: 'Vocabulary',
        topic: 'Vocabulary',
      })
    );
    expect(results[0].value.id).not.toBe('duplicate-id');
  });

  it('updates by id and topic while preserving the stored id and hiding _id', async () => {
    const existing = {
      _id: 'mongo-id',
      id: 'q457',
      topic: 'algebra',
      question: 'Before',
    };
    const collection = {
      findOne: vi.fn(async () => existing),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await modifyQuestion(
      'q457',
      { id: 'attempted-id-change', question: 'After' },
      'algebra'
    );

    expect(collection.findOne).toHaveBeenCalledWith({ id: 'q457', topic: 'algebra' });
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: 'mongo-id' },
      {
        $set: {
          id: 'q457',
          topic: 'algebra',
          question: 'After',
        },
      }
    );
    expect(result).toEqual({ id: 'q457', topic: 'algebra', question: 'After' });
  });

  it('uses deleteOne with a topic and deleteMany without one', async () => {
    const collection = {
      deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
      deleteMany: vi.fn(async () => ({ deletedCount: 2 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(removeQuestion('q457', 'algebra')).resolves.toBe(true);
    await expect(removeQuestion('q457')).resolves.toBe(true);

    expect(collection.deleteOne).toHaveBeenCalledWith({ id: 'q457', topic: 'algebra' });
    expect(collection.deleteMany).toHaveBeenCalledWith({ id: 'q457' });
  });

  it('bulk deletes unique ids and preserves the controller result contract', async () => {
    const collection = {
      deleteMany: vi.fn(async () => ({ deletedCount: 2 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await removeQuestionsBulk([' q1 ', 'q1', 'q2']);

    expect(collection.deleteMany).toHaveBeenCalledWith({ id: { $in: ['q1', 'q2'] } });
    expect(result).toEqual({ deleted: 2, failed: 0, total: 2 });
  });

  it('reports every requested id as failed when bulk deletion throws', async () => {
    const collection = {
      deleteMany: vi.fn(async () => {
        throw new Error('write failed');
      }),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(removeQuestionsBulk(['q1', 'q2'])).resolves.toEqual({
      deleted: 0,
      failed: 2,
      total: 2,
    });

    errorSpy.mockRestore();
  });
});
