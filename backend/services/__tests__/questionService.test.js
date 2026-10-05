import { beforeEach,describe,expect,it,vi } from 'vitest';

vi.mock('../questions/questionMetadataCache.js', () => ({ invalidateQuestionMetadata: vi.fn(), readQuestionMetadata: (_params, build) => build() }));
vi.mock('../questions/questionMetadataService.js', async (importOriginal) => ({ ...(await importOriginal()), refreshUploadedQuestionMetadata: vi.fn() }));

const { getQuestionsCollectionMock } = vi.hoisted(() => ({
  getQuestionsCollectionMock: vi.fn(),
}));

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: getQuestionsCollectionMock,
}));

import {
analyzeAnswers,
buildQuestionsCacheKey,
checkDuplicates,
createQuestion,
createQuestionsBulk,
fetchImageQuestions,
fetchPracticeTest,
fetchQuestionById,
fetchQuestionCounts,
fetchQuestions,
fetchQuestionsSession,
isStudyModeRecord,
matchesNormalizedTopic,
modifyQuestion,
normalizeQuizKey,
normalizeSearchKey,
questionCountsCache,
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
  questionCountsCache.clear();
});

describe('Question Service Helpers', () => {
  it('rejects retired deep offsets before issuing any question query', async () => {
    const find = vi.fn();
    getQuestionsCollectionMock.mockReturnValue({ find });
    await expect(fetchQuestions({ offset: 1001 })).rejects.toMatchObject({ statusCode: 400 });
    expect(find).not.toHaveBeenCalled();
  });

  it('preserves bounded legacy offset results', async () => {
    const cursor = createCursor([{ id: 'q1000' }]);
    cursor.skip = vi.fn(() => cursor);
    const countDocuments = vi.fn().mockResolvedValue(1200);
    getQuestionsCollectionMock.mockReturnValue({ find: vi.fn(() => cursor), countDocuments });
    expect(await fetchQuestions({ offset: 1000, limit: 1, questionType: 'all' })).toMatchObject({ total: 1200, questions: [{ id: 'q1000' }] });
    expect(cursor.skip).toHaveBeenCalledWith(1000);
  });
  it('preserves total counts on cached fallback pages', async () => {
    const direct = createCursor([]);
    const fallback = createCursor([{ id: 'a', chapter: 'Algebra' }, { id: 'b', chapter: 'Algebra' }]);
    const collection = { find: vi.fn().mockReturnValueOnce(direct).mockReturnValueOnce(fallback), countDocuments: vi.fn().mockResolvedValue(9) };
    getQuestionsCollectionMock.mockReturnValue(collection);
    const first = await fetchQuestions({ topic: 'Algebra', limit: 2 });
    const cached = await fetchQuestions({ topic: 'Algebra', limit: 2 });
    expect(first.count).toBe(9);
    expect(cached.count).toBe(9);
    expect(collection.find).toHaveBeenCalledTimes(2);
    expect(collection.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ $and: expect.any(Array) }));
  });
  it('bounds public question reads even when the caller omits or inflates limits', async () => {
    const cursor = createCursor([]);
    getQuestionsCollectionMock.mockReturnValue({ find: vi.fn(() => cursor) });
    await fetchQuestions({});
    expect(cursor.limit).toHaveBeenLastCalledWith(50);
    await fetchQuestions({ limit: 100000000 });
    expect(cursor.limit).toHaveBeenLastCalledWith(200);
    await fetchImageQuestions('visual_reasoning', 100000000);
    expect(cursor.limit).toHaveBeenLastCalledWith(100);
    await fetchPracticeTest({ count: 100000000 });
    expect(cursor.limit).toHaveBeenLastCalledWith(300);
  });
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

  it('handles simple and compound interest aliasing in matchesNormalizedTopic', () => {
    const siQuestion = {
      subject: 'Mathematics',
      topic: 'interest',
      question: 'Calculate the simple interest on Rs 5000',
    };
    const ciQuestion = {
      subject: 'Mathematics',
      topic: 'interest',
      question: 'Calculate the compound interest on Rs 5000',
    };
    const explicitSi = {
      subject: 'Mathematics',
      topic: 'simple-interest',
      question: 'Find the rate',
    };
    const explicitCi = {
      subject: 'Mathematics',
      topic: 'compound-interest',
      question: 'Find the amount',
    };

    expect(matchesNormalizedTopic(siQuestion, 'simpleinterest')).toBe(true);
    expect(matchesNormalizedTopic(siQuestion, 'compoundinterest')).toBe(false);
    expect(matchesNormalizedTopic(ciQuestion, 'compoundinterest')).toBe(true);
    expect(matchesNormalizedTopic(ciQuestion, 'simpleinterest')).toBe(false);
    expect(matchesNormalizedTopic(explicitSi, 'simpleinterest')).toBe(true);
    expect(matchesNormalizedTopic(explicitCi, 'compoundinterest')).toBe(true);
    expect(matchesNormalizedTopic(explicitSi, 'interest')).toBe(true);
    expect(matchesNormalizedTopic(explicitCi, 'interest')).toBe(true);
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
  it('aggregates compact mode counts and caches the result', async () => {
    const cursor = { toArray: vi.fn(async () => [
      { _id: { quizName: 'pyq' }, count: 12 },
      { _id: { quizName: 'career will' }, count: 4 },
      { _id: { quizName: 'selection way' }, count: 2 },
      {
        _id: {
          quizName: 'study mode',
          questionType: 'study-mode',
          hasWord: true,
          hasMeanings: true,
        },
        count: 3,
      },
    ]) };
    const collection = { aggregate: vi.fn(() => cursor) };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const expected = {
      concept: 12,
      formula: 4,
      mixed: 0,
      aiChallenge: 2,
      easy: 0,
      hard: 0,
      studyMode: 3,
    };

    await expect(fetchQuestionCounts({ topic: 'percentages', subject: 'mathematics' }))
      .resolves.toEqual(expected);
    await expect(fetchQuestionCounts({ topic: 'percentages', subject: 'mathematics' }))
      .resolves.toEqual(expected);

    expect(collection.aggregate).toHaveBeenCalledTimes(1);
    expect(collection.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { topic: 'percentages' },
    });
  });

  it('requires a topic or subject for count aggregation', async () => {
    await expect(fetchQuestionCounts({})).rejects.toMatchObject({
      message: 'topic or subject is required',
      statusCode: 400,
    });
  });

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
    const collection = { find: vi.fn(() => createCursor([{ ...question, _id: "mongo-id" }])) };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(fetchQuestionById('q457', 'algebra')).resolves.toEqual(question);
    expect(collection.find).toHaveBeenCalledWith({ id: { $in: ['q457'] }, topic: 'algebra' });
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
  const ineligibleAlgebra = { battleEligible: false, battleSelectionKey: expect.any(String), trainingMetadataVersion: 1, trainingCandidate: null, trainingEligible: false,
    trainingExamSlugs: [], trainingSubjectSlug: 'unclassified', trainingTopicSlug: 'algebra' };
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
    expect(result).toEqual({
      ...ineligibleAlgebra,
      id: 'new-id',
      questionUid: expect.stringMatching(/^q_[a-f0-9]{32}$/),
      chapter: ' Algebra ',
      topic: 'Algebra',
      topicKey: 'algebra',
      subjectKey: '',
      quizKey: '',
      modeKey: 'concept',
      keyVersion: 1,
    });
    expect(questionsQueryCache.has('stale')).toBe(false);
  });

  it('bulk creates with per-row results and retries duplicate ids', async () => {
    const collection = {
      bulkWrite: vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000, result: {}, writeErrors: [{ index: 0, code: 11000 }] }))
        .mockResolvedValue({ acknowledged: true }),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const results = await createQuestionsBulk([
      { id: 'duplicate-id', quizSubject: 'English', quizTopic: 'Vocabulary' },
    ]);

    expect(collection.bulkWrite).toHaveBeenCalledTimes(2);
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

  it('bulk imports invalid rows and preserves idempotency metadata', async () => {
    const collection = {
      bulkWrite: vi.fn(async () => ({ acknowledged: true })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const results = await createQuestionsBulk(
      [null, { quizSubject: 'English', quizTopic: 'Vocabulary' }],
      { importId: 'import-1' },
    );

    expect(results[0]).toEqual({
      status: 'rejected',
      reason: { code: 'INVALID_ROW', message: 'Question must be an object' },
    });
    expect(results[1]).toMatchObject({ status: 'fulfilled' });
    expect(collection.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: {
              ingestionKey: expect.any(String),
              ingestionHash: expect.any(String),
            },
            update: { $setOnInsert: expect.objectContaining({ id: expect.stringMatching(/^q_/) }) },
            upsert: true,
          },
        },
      ],
      { ordered: false },
    );
  });

  it('returns rejected results for non-duplicate bulk write failures', async () => {
    const collection = {
      bulkWrite: vi.fn().mockRejectedValueOnce(
        Object.assign(new Error('validation failed'), {
          code: 121,
          result: {},
          writeErrors: [{ index: 0, code: 121, errmsg: 'validation failed' }],
        }),
      ),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(createQuestionsBulk([{ id: 'invalid-row' }])).resolves.toEqual([
      { status: 'rejected', reason: { code: 121, message: 'validation failed' } },
    ]);
  });

  it('updates by id and topic while preserving the stored id and hiding _id', async () => {
    const existing = {
      _id: 'mongo-id',
      id: 'q457',
      topic: 'algebra',
      question: 'Before',
    };
    const collection = {
      find: vi.fn(() => createCursor([existing])),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await modifyQuestion(
      'q457',
      { id: 'attempted-id-change', question: 'After' },
      'algebra'
    );

    expect(collection.find).toHaveBeenCalledWith({ id: { $in: ['q457'] }, topic: 'algebra' });
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: 'mongo-id' },
      {
        $set: {
          ...ineligibleAlgebra,
          id: 'q457',
          questionUid: undefined,
          topic: 'algebra',
          question: 'After',
          topicKey: 'algebra', subjectKey: '', quizKey: '', modeKey: 'concept', keyVersion: 1,
        },
      }
    );
    expect(result).toEqual({ ...ineligibleAlgebra, id: 'q457', questionUid: undefined, topic: 'algebra', question: 'After', topicKey: 'algebra', subjectKey: '', quizKey: '', modeKey: 'concept', keyVersion: 1 });
  });

  it('returns null or false when a write target does not exist', async () => {
    const collection = {
      find: vi.fn(() => createCursor([])),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(modifyQuestion('missing-id', { question: 'After' })).resolves.toBeNull();
    await expect(removeQuestion('missing-id')).resolves.toBe(false);
  });

  it('uses update metadata when the existing question has no topic', async () => {
    const existing = { _id: 'mongo-id', id: 'q457', question: 'Before' };
    const collection = {
      find: vi.fn(() => createCursor([existing])),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(modifyQuestion('q457', { chapter: 'Algebra' })).resolves.toMatchObject({
      id: 'q457',
      topic: 'Algebra',
    });
  });

  it('resolves a unique document before deleting with or without a topic', async () => {
    const collection = {
      deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
      find: vi.fn(filter => createCursor([{ _id: filter.id.$in[0], id: filter.id.$in[0] }])),
      deleteMany: vi.fn(async () => ({ deletedCount: 2 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(removeQuestion('q457', 'algebra')).resolves.toBe(true);
    await expect(removeQuestion('q457')).resolves.toBe(true);

    expect(collection.deleteOne).toHaveBeenCalledWith({ _id: 'q457' });
    expect(collection.deleteMany).not.toHaveBeenCalled();
  });

  it('returns false when a resolved question is not deleted', async () => {
    const collection = {
      find: vi.fn(() => createCursor([{ _id: 'mongo-id', id: 'q457' }])),
      deleteOne: vi.fn(async () => ({ deletedCount: 0 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    await expect(removeQuestion('q457')).resolves.toBe(false);
  });

  it('returns empty results for empty bulk deletion and duplicate checks', async () => {
    getQuestionsCollectionMock.mockReturnValue({ find: vi.fn() });

    await expect(removeQuestionsBulk()).resolves.toEqual({ deleted: 0, failed: 0, total: 0 });
    await expect(removeQuestionsBulk([' ', ''])).resolves.toEqual({ deleted: 0, failed: 0, total: 0 });
    await expect(checkDuplicates([{ question: '   ' }, {}])).resolves.toEqual([]);
  });

  it('bulk deletes unique ids and preserves the controller result contract', async () => {
    const collection = {
      find: vi.fn(filter => createCursor([{ _id: filter.id.$in[0], id: filter.id.$in[0] }])),
      deleteMany: vi.fn(async () => ({ deletedCount: 2 })),
    };
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await removeQuestionsBulk([' q1 ', 'q1', 'q2']);

    expect(collection.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['q1', 'q2'] } });
    expect(result).toEqual({ deleted: 2, failed: 0, total: 2 });
  });

  it('reports every requested id as failed when bulk deletion throws', async () => {
    const collection = {
      find: vi.fn(filter => createCursor([{ _id: filter.id.$in[0] }])),
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

  it('queries session questions with formula mode excluding study mode and caps session pages at 200 without counting by default', async () => {
    const mockDocs = [{ _id: 'id1', id: 'anto_syno_1', letter: 'A' }, { _id: 'id2', id: 'anto_syno_2', letter: 'B' }];
    
    const cursor = {
      project: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(mockDocs),
    };
    
    const collection = {
      find: vi.fn().mockReturnValue(cursor),
      countDocuments: vi.fn().mockResolvedValue(5),
    };
    
    getQuestionsCollectionMock.mockReturnValue(collection);

    const result = await fetchQuestionsSession({
      topic: 'synonyms-antonyms',
      mode: 'formula',
      limit: 5000,
    });

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]._id).toBeUndefined();
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBeUndefined();
    expect(collection.countDocuments).not.toHaveBeenCalled();
    expect(cursor.limit).toHaveBeenCalledWith(201);

    const firstFindFilter = collection.find.mock.calls[0][0];
    expect(firstFindFilter.$and).toBeDefined();
    expect(JSON.stringify(firstFindFilter)).toContain('$expr');
  });
});
