// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import {
  toPublicQuestionDTO,
  toQuizQuestionDTO,
  isSensitiveField,
  sanitizeTranslations,
  SENSITIVE_QUESTION_FIELDS,
  quizQuestionProjection,
} from '../../services/questions/quizQuestionDTO.js';

// Hoist mock references for isolation
const { getQuestionsCollectionMock } = vi.hoisted(() => ({
  getQuestionsCollectionMock: vi.fn(),
}));

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: getQuestionsCollectionMock,
  getMongoDB: () => ({
    collection: getQuestionsCollectionMock,
  }),
  withMongoTransaction: vi.fn(async (cb) => {
    return cb({
      db: { collection: getQuestionsCollectionMock },
      session: {},
    });
  }),
}));

vi.mock('../../services/questions/questionMetadataCache.js', () => ({
  invalidateQuestionMetadata: vi.fn(),
  readQuestionMetadata: (_params, build) => build(),
}));

vi.mock('../../middleware/auth.js', () => ({
  default: (_req, _res, next) => next(),
  adminAuth: (_req, _res, next) => next(),
}));

vi.mock('../../middleware/protect.js', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'test_student_user_1', role: 'student' };
    next();
  },
}));

import questionRoutes from '../../routes/questionRoutes.js';

function createMockCursor(docs) {
  const cursor = {
    project: vi.fn(() => cursor),
    sort: vi.fn(() => cursor),
    skip: vi.fn(() => cursor),
    limit: vi.fn(() => cursor),
    collation: vi.fn(() => cursor),
    toArray: vi.fn(async () => docs),
  };
  return cursor;
}

describe('EMPIRICAL CHALLENGER: Milestone 1 Iteration 2 Hardening & Edge Cases', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/questions', questionRoutes);
    app.use((err, _req, res, _next) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/questions`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────
  // TASK 1: Verification of Previously Failing Cases
  // ──────────────────────────────────────────────────────────
  describe('Task 1: Explicit Verification of 3 Previously Failing Cases', () => {
    const baseQuestion = {
      _id: '672000000000000000000010',
      id: 'q_verify_prev_01',
      questionUid: 'uid_verify_prev_01',
      subject: 'mathematics',
      topic: 'algebra',
      question: 'Solve for y: 3y = 9',
      options: ['y=1', 'y=2', 'y=3', 'y=4'],
      correctAnswer: 'y=3',
      solution: 'Divide 9 by 3 to get 3',
      translations: {
        bn: {
          question: 'y এর মান নির্ণয় কর: 3y = 9',
          options: ['১', '২', '৩', '৪'],
          solution: 'গোপন সমাধান: y = ৩',
          solutionImage: 'https://cdn.meowguru.test/bn_secret.png',
        },
      },
    };

    it('Case 1: Nested translations solution leakage (translations.bn.solution, translations.bn.solutionImage) strictly stripped', () => {
      const publicDto = toPublicQuestionDTO(baseQuestion);
      const quizDto = toQuizQuestionDTO(baseQuestion);

      // Verify bn solution & solutionImage stripped in public DTO
      expect(publicDto.translations?.bn?.solution).toBeUndefined();
      expect(publicDto.translations?.bn?.solutionImage).toBeUndefined();
      // Verify translated question & options preserved in public DTO
      expect(publicDto.translations?.bn?.question).toBe('y এর মান নির্ণয় কর: 3y = 9');
      expect(publicDto.translations?.bn?.options).toEqual(['১', '২', '৩', '৪']);

      // Verify bn solution & solutionImage stripped in quiz DTO
      expect(quizDto.translations?.bn?.solution).toBeUndefined();
      expect(quizDto.translations?.bn?.solutionImage).toBeUndefined();
      // Verify translated question & options preserved in quiz DTO
      expect(quizDto.translations?.bn?.question).toBe('y এর মান নির্ণয় কর: 3y = 9');
      expect(quizDto.translations?.bn?.options).toEqual(['১', '২', '৩', '৪']);
    });

    it('Case 2: Non-standard casing and legacy field names (solutionText, correctIndex, explanation, CorrectAnswer) strictly stripped', () => {
      const legacyDoc = {
        _id: '672000000000000000000011',
        id: 'q_verify_legacy_02',
        question: 'What is 10 + 10?',
        options: ['15', '20', '25', '30'],
        solutionText: 'Add 10 and 10 to obtain 20',
        correctIndex: 1,
        explanation: 'Addition rule',
        CorrectAnswer: '20',
        answerKey: '20',
        ANSWER: '20',
      };

      const publicDto = toPublicQuestionDTO(legacyDoc);
      const quizDto = toQuizQuestionDTO(legacyDoc);

      expect(publicDto.solutionText).toBeUndefined();
      expect(publicDto.correctIndex).toBeUndefined();
      expect(publicDto.explanation).toBeUndefined();
      expect(publicDto.CorrectAnswer).toBeUndefined();
      expect(publicDto.answerKey).toBeUndefined();
      expect(publicDto.ANSWER).toBeUndefined();

      expect(quizDto.solutionText).toBeUndefined();
      expect(quizDto.correctIndex).toBeUndefined();
      expect(quizDto.explanation).toBeUndefined();
      expect(quizDto.CorrectAnswer).toBeUndefined();
      expect(quizDto.answerKey).toBeUndefined();
      expect(quizDto.ANSWER).toBeUndefined();
    });

    it('Case 3: Localized question solution leakage over public HTTP endpoints strictly blocked', async () => {
      const cursor = createMockCursor([{ ...baseQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        findOne: vi.fn(async () => ({ ...baseQuestion })),
        countDocuments: vi.fn(async () => 1),
      });

      // 1. GET /api/questions
      const resList = await fetch(`${baseUrl}?topic=algebra`);
      const bodyList = await resList.json();
      const qList = bodyList.questions[0];
      expect(qList.translations?.bn?.solution).toBeUndefined();
      expect(qList.translations?.bn?.solutionImage).toBeUndefined();
      expect(qList.translations?.bn?.question).toBe('y এর মান নির্ণয় কর: 3y = 9');

      // 2. GET /api/questions/:id
      const resItem = await fetch(`${baseUrl}/q_verify_prev_01`);
      const qItem = await resItem.json();
      expect(qItem.translations?.bn?.solution).toBeUndefined();
      expect(qItem.translations?.bn?.solutionImage).toBeUndefined();
      expect(qItem.translations?.bn?.question).toBe('y এর মান নির্ণয় কর: 3y = 9');

      // 3. GET /api/questions/session
      const resSession = await fetch(`${baseUrl}/session?topic=algebra`);
      const bodySession = await resSession.json();
      const qSession = bodySession.questions[0];
      expect(qSession.translations?.bn?.solution).toBeUndefined();
      expect(qSession.translations?.bn?.solutionImage).toBeUndefined();
      expect(qSession.translations?.bn?.question).toBe('y এর মান নির্ণয় কর: 3y = 9');
    });
  });

  // ──────────────────────────────────────────────────────────
  // TASK 2: Attack Implementation With Deep Edge Cases
  // ──────────────────────────────────────────────────────────
  describe('Task 2: Attack Implementation With Edge Cases', () => {
    describe('2.1 Multiple Nested Translation Languages', () => {
      const multiLangDoc = {
        _id: '672000000000000000000020',
        id: 'q_multilang_attack',
        question: 'Global question in English',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        solution: 'Global solution',
        translations: {
          hi: {
            question: 'हिंदी प्रश्न',
            options: ['क', 'ख', 'ग', 'घ'],
            solution: 'गुप्त समाधान (Hindi secret)',
            solutionImage: 'https://cdn.meowguru.test/hi_secret.png',
            explanation: 'हिंदी व्याख्या',
          },
          es: {
            question: 'Pregunta en español',
            options: ['Uno', 'Dos', 'Tres', 'Cuatro'],
            explanation: 'Explicación secreta en español',
            solutionText: 'Texto de solución española',
          },
          fr: {
            question: 'Question en français',
            options: ['Un', 'Deux', 'Trois', 'Quatre'],
            solutionImage: 'https://cdn.meowguru.test/fr_secret.png',
            solution: 'Solution secrète',
            correctAnswer: 'Deux',
          },
          te: {
            question: 'తెలుగు ప్రశ్న',
            options: ['ఒకటి', 'రెండు', 'మూడు', 'నాలుగు'],
            correctIndex: 1,
            CorrectAnswer: 'రెండు',
          },
          ta: {
            question: 'தமிழ் கேள்வி',
            options: ['ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு'],
            answerKey: 'இரண்டு',
            cOrReCtAnSwEr: 'இரண்டு',
          },
        },
      };

      it('strips all sensitive solutions, explanations, and keys across all nested language translations in toPublicQuestionDTO', () => {
        const publicDto = toPublicQuestionDTO(multiLangDoc);
        const trans = publicDto.translations;

        expect(trans.hi.solution).toBeUndefined();
        expect(trans.hi.solutionImage).toBeUndefined();
        expect(trans.hi.explanation).toBeUndefined();
        expect(trans.hi.question).toBe('हिंदी प्रश्न');
        expect(trans.hi.options).toEqual(['क', 'ख', 'ग', 'घ']);

        expect(trans.es.explanation).toBeUndefined();
        expect(trans.es.solutionText).toBeUndefined();
        expect(trans.es.question).toBe('Pregunta en español');

        expect(trans.fr.solutionImage).toBeUndefined();
        expect(trans.fr.solution).toBeUndefined();
        expect(trans.fr.correctAnswer).toBeUndefined();
        expect(trans.fr.question).toBe('Question en français');

        expect(trans.te.correctIndex).toBeUndefined();
        expect(trans.te.CorrectAnswer).toBeUndefined();
        expect(trans.te.question).toBe('తెలుగు ప్రశ్న');

        expect(trans.ta.answerKey).toBeUndefined();
        expect(trans.ta.cOrReCtAnSwEr).toBeUndefined();
        expect(trans.ta.question).toBe('தமிழ் கேள்வி');
      });

      it('strips all sensitive solutions, explanations, and keys across all nested language translations in toQuizQuestionDTO', () => {
        const quizDto = toQuizQuestionDTO(multiLangDoc);
        const trans = quizDto.translations;

        expect(trans.hi.solution).toBeUndefined();
        expect(trans.hi.solutionImage).toBeUndefined();
        expect(trans.hi.explanation).toBeUndefined();
        expect(trans.hi.question).toBe('हिंदी प्रश्न');
        expect(trans.hi.options).toEqual(['क', 'ख', 'ग', 'घ']);

        expect(trans.es.explanation).toBeUndefined();
        expect(trans.es.solutionText).toBeUndefined();
        expect(trans.es.question).toBe('Pregunta en español');

        expect(trans.fr.solutionImage).toBeUndefined();
        expect(trans.fr.solution).toBeUndefined();
        expect(trans.fr.correctAnswer).toBeUndefined();
        expect(trans.fr.question).toBe('Question en français');

        expect(trans.te.correctIndex).toBeUndefined();
        expect(trans.te.CorrectAnswer).toBeUndefined();
        expect(trans.te.question).toBe('తెలుగు ప్రశ్న');

        expect(trans.ta.answerKey).toBeUndefined();
        expect(trans.ta.cOrReCtAnSwEr).toBeUndefined();
        expect(trans.ta.question).toBe('தமிழ் கேள்வி');
      });
    });

    describe('2.2 Non-String Keys, Symbols, and Arrays in Translations', () => {
      it('handles numeric and coerced keys inside translations without throwing', () => {
        const docWithNumericKeys = {
          id: 'q_numeric_keys',
          question: 'Numeric key test',
          translations: {
            '100': {
              question: 'Language code 100 question',
              solution: 'Secret 100 solution',
              explanation: 'Secret 100 explanation',
            },
            '200': {
              question: 'Language code 200 question',
              options: ['opt1', 'opt2'],
            },
          },
        };

        const publicDto = toPublicQuestionDTO(docWithNumericKeys);
        expect(publicDto.translations['100'].solution).toBeUndefined();
        expect(publicDto.translations['100'].explanation).toBeUndefined();
        expect(publicDto.translations['100'].question).toBe('Language code 100 question');
        expect(publicDto.translations['200'].options).toEqual(['opt1', 'opt2']);
      });

      it('safely handles symbol properties without throwing or leaking in JSON serialization', () => {
        const symKey = Symbol('hiddenSolution');
        const docWithSymbol = {
          id: 'q_symbol_test',
          question: 'Symbol test question',
          translations: {
            bn: {
              question: 'Bengali question',
              [symKey]: 'Secret via symbol',
              solution: 'Secret solution',
            },
          },
        };

        const publicDto = toPublicQuestionDTO(docWithSymbol);
        expect(publicDto.translations.bn.solution).toBeUndefined();
        expect(publicDto.translations.bn.question).toBe('Bengali question');

        const serialized = JSON.stringify(publicDto);
        expect(serialized).not.toContain('Secret via symbol');
        expect(serialized).not.toContain('Secret solution');
      });

      it('handles primitive values or arrays placed directly inside translations mapping', () => {
        const docWithPrimitiveTranslations = {
          id: 'q_malformed_trans',
          question: 'Malformed translation test',
          translations: {
            rawString: 'Just a string',
            rawNumber: 42,
            rawNull: null,
            rawArray: ['element1', 'element2'],
            validLang: {
              question: 'Valid question',
              solution: 'Leaked solution',
            },
          },
        };

        const publicDto = toPublicQuestionDTO(docWithPrimitiveTranslations);
        expect(publicDto.translations.rawString).toBe('Just a string');
        expect(publicDto.translations.rawNumber).toBe(42);
        expect(publicDto.translations.rawNull).toBeNull();
        expect(publicDto.translations.rawArray).toEqual(['element1', 'element2']);
        expect(publicDto.translations.validLang.question).toBe('Valid question');
        expect(publicDto.translations.validLang.solution).toBeUndefined();
      });
    });

    describe('2.3 Casing Permutations & Sensitive Pattern Matching', () => {
      const casingTargets = [
        'cOrReCtAnSwEr',
        'SOLUTION_TEXT',
        'ExPlAnAtIoN',
        'CORRECT_ANSWER',
        'correct_answer',
        'cOrReCt_InDeX',
        'sOlUtIoN_iMaGe',
        'ANSWER_KEY',
        'AnswerKey',
        'AnSwEr',
        'iNgEsTiOn_KeY',
        'bAtTlEsElEcTiOnKeY',
        'TrAiNiNgCaNdIdAtE',
        'training_exam_slugs',
        'TRAINING_TOPIC_SLUG',
        'EXPLANATION',
        'Solution',
        'CorrectLetter',
        'CORRECTLETTER',
        'correctletter',
        'correct_letter',
        'solutionImageWidth',
        'SOLUTIONIMAGEHEIGHT',
        'ingestionHash',
        'INGESTION_HASH',
      ];

      it('isSensitiveField detects all casing and delimiter variations as sensitive', () => {
        for (const target of casingTargets) {
          expect(
            isSensitiveField(target),
            `isSensitiveField('${target}') must return true`
          ).toBe(true);
        }
      });

      it('toPublicQuestionDTO strips every casing permutation from top-level question doc', () => {
        const dirtyDoc = {
          id: 'q_casing_stress_test',
          question: 'Casing test question',
          options: ['1', '2'],
          ...Object.fromEntries(casingTargets.map((key) => [key, `secret_value_for_${key}`])),
        };

        const publicDto = toPublicQuestionDTO(dirtyDoc);

        for (const target of casingTargets) {
          expect(
            publicDto[target],
            `Field ${target} must be stripped from public DTO`
          ).toBeUndefined();
        }

        expect(publicDto.id).toBe('q_casing_stress_test');
        expect(publicDto.question).toBe('Casing test question');
        expect(publicDto.options).toEqual(['1', '2']);
      });

      it('toQuizQuestionDTO strictly drops every casing permutation', () => {
        const dirtyDoc = {
          id: 'q_casing_quiz_test',
          question: 'Casing quiz test',
          options: ['1', '2'],
          ...Object.fromEntries(casingTargets.map((key) => [key, `secret_value_for_${key}`])),
        };

        const quizDto = toQuizQuestionDTO(dirtyDoc);

        for (const target of casingTargets) {
          expect(
            quizDto[target],
            `Field ${target} must be dropped from quiz DTO`
          ).toBeUndefined();
        }

        expect(quizDto.id).toBe('q_casing_quiz_test');
        expect(quizDto.question).toBe('Casing quiz test');
        expect(quizDto.options).toEqual(['1', '2']);
      });
    });

    describe('2.4 Dynamic Legitimate Fields Preservation', () => {
      const fullRichQuestion = {
        _id: '672000000000000000000030',
        id: 'q_vocab_geometry_rich',
        questionUid: 'uid_rich_001',
        topic: 'geometry',
        subject: 'mathematics',
        chapter: 'triangles',
        concept: 'Pythagoras',
        difficulty: 'hard',
        exam: 'ssc-cgl',
        year: 2024,
        formula: 'a^2 + b^2 = c^2',
        question: 'Find hypotenuse if legs are 3 and 4',
        options: ['4', '5', '6', '7'],
        quizName: 'geometry_mastery',
        questionType: 'multiple_choice',
        questionImage: 'https://cdn.meowguru.test/questions/geom_01.png',
        questionImageWidth: 800,
        questionImageHeight: 600,
        optionRegions: [{ id: 'opt_1', x: 10, y: 10 }],
        diagram: { type: 'svg', url: 'https://cdn.meowguru.test/diagrams/triangle.svg' },
        needs_diagram: true,
        word: 'hypotenuse',
        letter: 'h',
        source: 'previous_year_papers',
        quizId: 'quiz_geom_99',
        meanings: ['The longest side of a right-angled triangle'],
        synonyms: ['longest side'],
        antonyms: ['base', 'perpendicular'],
        tags: ['pythagoras', 'right-triangle', 'cgl-tier-1'],
        extraMetadata: { customSource: 'NCERT', chapterNo: 7 },
        scoreMultiplier: 1.5,
        flagValue: 'verified_active',
        // Sensitive fields that MUST be stripped
        correctAnswer: '5',
        correctLetter: 'B',
        solution: '3^2 + 4^2 = 9 + 16 = 25, sqrt(25) = 5',
        solutionImage: 'https://cdn.meowguru.test/solutions/geom_01.png',
        solutionText: 'Use pythagorean theorem',
        cOrReCtAnSwEr: '5',
        translations: {
          bn: {
            question: 'অতিভুজ নির্ণয় কর যদি বাহুদ্বয় ৩ ও ৪ হয়',
            options: ['৪', '৫', '৬', '৭'],
            word: 'অতিভুজ',
            meanings: ['সমকোণী ত্রিভুজের বৃহত্তম বাহু'],
            synonyms: ['বৃহত্তম বাহু'],
            antonyms: ['ভূমি', 'লম্ব'],
            solution: 'গোপন সমাধান: অতিভুজ = ৫',
            solutionImage: 'https://cdn.meowguru.test/bn_geom_sol.png',
          },
        },
      };

      it('preserves all dynamic legitimate fields in toPublicQuestionDTO while purging secrets', () => {
        const publicDto = toPublicQuestionDTO(fullRichQuestion);

        // Verify preservation of legitimate fields
        expect(publicDto.id).toBe('q_vocab_geometry_rich');
        expect(publicDto.topic).toBe('geometry');
        expect(publicDto.subject).toBe('mathematics');
        expect(publicDto.tags).toEqual(['pythagoras', 'right-triangle', 'cgl-tier-1']);
        expect(publicDto.diagram).toEqual({ type: 'svg', url: 'https://cdn.meowguru.test/diagrams/triangle.svg' });
        expect(publicDto.needs_diagram).toBe(true);
        expect(publicDto.word).toBe('hypotenuse');
        expect(publicDto.letter).toBe('h');
        expect(publicDto.meanings).toEqual(['The longest side of a right-angled triangle']);
        expect(publicDto.synonyms).toEqual(['longest side']);
        expect(publicDto.antonyms).toEqual(['base', 'perpendicular']);
        expect(publicDto.questionImage).toBe('https://cdn.meowguru.test/questions/geom_01.png');
        expect(publicDto.questionImageWidth).toBe(800);
        expect(publicDto.questionImageHeight).toBe(600);
        expect(publicDto.year).toBe(2024);
        expect(publicDto.formula).toBe('a^2 + b^2 = c^2');
        expect(publicDto.extraMetadata).toEqual({ customSource: 'NCERT', chapterNo: 7 });
        expect(publicDto.scoreMultiplier).toBe(1.5);
        expect(publicDto.flagValue).toBe('verified_active');

        // Check nested translation legitimate fields
        expect(publicDto.translations.bn.question).toBe('অতিভুজ নির্ণয় কর যদি বাহুদ্বয় ৩ ও ৪ হয়');
        expect(publicDto.translations.bn.options).toEqual(['৪', '৫', '৬', '৭']);
        expect(publicDto.translations.bn.word).toBe('অতিভুজ');
        expect(publicDto.translations.bn.meanings).toEqual(['সমকোণী ত্রিভুজের বৃহত্তম বাহু']);
        expect(publicDto.translations.bn.synonyms).toEqual(['বৃহত্তম বাহু']);
        expect(publicDto.translations.bn.antonyms).toEqual(['ভূমি', 'লম্ব']);

        // Check secret purging
        expect(publicDto.correctAnswer).toBeUndefined();
        expect(publicDto.correctLetter).toBeUndefined();
        expect(publicDto.solution).toBeUndefined();
        expect(publicDto.solutionImage).toBeUndefined();
        expect(publicDto.solutionText).toBeUndefined();
        expect(publicDto.cOrReCtAnSwEr).toBeUndefined();
        expect(publicDto.translations.bn.solution).toBeUndefined();
        expect(publicDto.translations.bn.solutionImage).toBeUndefined();
      });

      it('preserves all supported quizQuestionProjection fields in toQuizQuestionDTO while purging secrets', () => {
        const quizDto = toQuizQuestionDTO(fullRichQuestion);

        // Allowed projection fields preserved
        expect(quizDto.id).toBe('q_vocab_geometry_rich');
        expect(quizDto.topic).toBe('geometry');
        expect(quizDto.subject).toBe('mathematics');
        expect(quizDto.tags).toEqual(['pythagoras', 'right-triangle', 'cgl-tier-1']);
        expect(quizDto.diagram).toEqual({ type: 'svg', url: 'https://cdn.meowguru.test/diagrams/triangle.svg' });
        expect(quizDto.needs_diagram).toBe(true);
        expect(quizDto.word).toBe('hypotenuse');
        expect(quizDto.letter).toBe('h');
        expect(quizDto.meanings).toEqual(['The longest side of a right-angled triangle']);
        expect(quizDto.synonyms).toEqual(['longest side']);
        expect(quizDto.antonyms).toEqual(['base', 'perpendicular']);
        expect(quizDto.questionImage).toBe('https://cdn.meowguru.test/questions/geom_01.png');
        expect(quizDto.questionImageWidth).toBe(800);
        expect(quizDto.questionImageHeight).toBe(600);
        expect(quizDto.year).toBe(2024);
        expect(quizDto.formula).toBe('a^2 + b^2 = c^2');
        expect(quizDto.sessionAnchor).toBe('672000000000000000000030');

        // Check nested translation legitimate fields
        expect(quizDto.translations.bn.question).toBe('অতিভুজ নির্ণয় কর যদি বাহুদ্বয় ৩ ও ৪ হয়');
        expect(quizDto.translations.bn.options).toEqual(['৪', '৫', '৬', '৭']);
        expect(quizDto.translations.bn.word).toBe('অতিভুজ');
        expect(quizDto.translations.bn.meanings).toEqual(['সমকোণী ত্রিভুজের বৃহত্তম বাহু']);
        expect(quizDto.translations.bn.synonyms).toEqual(['বৃহত্তম বাহু']);
        expect(quizDto.translations.bn.antonyms).toEqual(['ভূমি', 'লম্ব']);

        // Check secret purging
        expect(quizDto.correctAnswer).toBeUndefined();
        expect(quizDto.correctLetter).toBeUndefined();
        expect(quizDto.solution).toBeUndefined();
        expect(quizDto.solutionImage).toBeUndefined();
        expect(quizDto.solutionText).toBeUndefined();
        expect(quizDto.cOrReCtAnSwEr).toBeUndefined();
        expect(quizDto.translations.bn.solution).toBeUndefined();
        expect(quizDto.translations.bn.solutionImage).toBeUndefined();
      });
    });

    describe('2.5 Public HTTP Endpoints Integration With Rich Question Payloads', () => {
      const richEndpointDoc = {
        _id: '672000000000000000000040',
        id: 'q_http_rich_01',
        subject: 'english',
        topic: 'vocabulary',
        word: 'ephemeral',
        meanings: ['lasting for a very short time'],
        synonyms: ['transitory', 'fleeting'],
        antonyms: ['permanent', 'eternal'],
        tags: ['vocab', 'cgl', 'adjective'],
        diagram: { url: 'https://cdn.meowguru.test/diag.png' },
        question: 'Choose the antonym of ephemeral',
        options: ['transitory', 'fleeting', 'permanent', 'short-lived'],
        correctAnswer: 'permanent',
        solution: 'Ephemeral means temporary; permanent means lasting',
        solutionText: 'Legacy explanation',
        cOrReCtAnSwEr: 'permanent',
        translations: {
          bn: {
            question: 'ephemeral শব্দের বিপরীতার্থক শব্দ কোনটি?',
            word: 'ephemeral',
            meanings: ['ক্ষণস্থায়ী'],
            synonyms: ['অস্থায়ী'],
            antonyms: ['চিরস্থায়ী'],
            solution: 'সঠিক উত্তর: চিরস্থায়ী',
          },
          hi: {
            question: 'ephemeral का विलोम चुनें',
            word: 'ephemeral',
            solution: 'सही उत्तर: permanent',
          },
        },
      };

      it('GET /api/questions serves all legitimate dynamic fields while scrubbing answers across languages', async () => {
        const cursor = createMockCursor([{ ...richEndpointDoc }]);
        getQuestionsCollectionMock.mockReturnValue({
          find: vi.fn(() => cursor),
          countDocuments: vi.fn(async () => 1),
        });

        // Request with questionType=study-mode to match vocabulary study records with word + meanings
        const res = await fetch(`${baseUrl}?topic=vocabulary&questionType=study-mode`);
        expect(res.status).toBe(200);
        const body = await res.json();
        const q = body.questions[0];

        // Legitimate fields
        expect(q.word).toBe('ephemeral');
        expect(q.meanings).toEqual(['lasting for a very short time']);
        expect(q.synonyms).toEqual(['transitory', 'fleeting']);
        expect(q.antonyms).toEqual(['permanent', 'eternal']);
        expect(q.tags).toEqual(['vocab', 'cgl', 'adjective']);
        expect(q.diagram).toEqual({ url: 'https://cdn.meowguru.test/diag.png' });

        // Translations preserved
        expect(q.translations.bn.word).toBe('ephemeral');
        expect(q.translations.bn.meanings).toEqual(['ক্ষণস্থায়ী']);
        expect(q.translations.hi.word).toBe('ephemeral');

        // Solutions scrubbed
        expect(q.correctAnswer).toBeUndefined();
        expect(q.solution).toBeUndefined();
        expect(q.solutionText).toBeUndefined();
        expect(q.cOrReCtAnSwEr).toBeUndefined();
        expect(q.translations.bn.solution).toBeUndefined();
        expect(q.translations.hi.solution).toBeUndefined();
      });

      it('GET /api/questions/:id serves legitimate dynamic fields while scrubbing answers across languages', async () => {
        const cursor = createMockCursor([{ ...richEndpointDoc }]);
        getQuestionsCollectionMock.mockReturnValue({
          find: vi.fn(() => cursor),
          findOne: vi.fn(async () => ({ ...richEndpointDoc })),
        });

        const res = await fetch(`${baseUrl}/q_http_rich_01`);
        expect(res.status).toBe(200);
        const q = await res.json();

        // Legitimate fields
        expect(q.word).toBe('ephemeral');
        expect(q.tags).toEqual(['vocab', 'cgl', 'adjective']);
        expect(q.translations.bn.meanings).toEqual(['ক্ষণস্থায়ী']);

        // Solutions scrubbed
        expect(q.correctAnswer).toBeUndefined();
        expect(q.solution).toBeUndefined();
        expect(q.translations.bn.solution).toBeUndefined();
        expect(q.translations.hi.solution).toBeUndefined();
      });

      it('GET /api/questions/session serves legitimate dynamic fields while scrubbing answers across languages', async () => {
        const cursor = createMockCursor([{ ...richEndpointDoc }]);
        getQuestionsCollectionMock.mockReturnValue({
          find: vi.fn(() => cursor),
        });

        const res = await fetch(`${baseUrl}/session?topic=vocabulary`);
        expect(res.status).toBe(200);
        const body = await res.json();
        const q = body.questions[0];

        expect(q.word).toBe('ephemeral');
        expect(q.tags).toEqual(['vocab', 'cgl', 'adjective']);
        expect(q.translations.bn.word).toBe('ephemeral');
        expect(q.translations.bn.meanings).toEqual(['ক্ষণস্থায়ী']);

        expect(q.correctAnswer).toBeUndefined();
        expect(q.solution).toBeUndefined();
        expect(q.translations.bn.solution).toBeUndefined();
        expect(q.translations.hi.solution).toBeUndefined();
      });
    });
  });
});
