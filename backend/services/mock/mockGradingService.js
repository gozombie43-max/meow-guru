import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { mockAnswerCorrect, isUnanswered } from '../mockAnswer.js';
import { getExamConfig } from '../../config/exam-config.js';
import { getMockAttemptsCollection } from '../../config/mongodb.js';

const percentileCountCache = createTieredCache({
  name: 'mock-percentile',
  freshMs: 45_000,
  staleMs: 60_000,
  localMs: 15_000,
  distributedLock: false,
  isEmpty: value => typeof value !== 'number' || !Number.isFinite(value) || value < 0,
});

export function invalidateMockPercentileCache(examSlug = null, testId = null) {
  if (!examSlug && !testId) {
    percentileCountCache.clear();
    return;
  }
  const prefix = `meow:v1:mock-pct:${examSlug || ''}:${testId || ''}:`;
  percentileCountCache.deleteWhere(key => String(key || '').startsWith(prefix));
}

export function gradeAttempt({ attemptDoc }) {
  const paperSections = Array.isArray(attemptDoc.paper?.sections) ? attemptDoc.paper.sections : [];
  const hasSnapshottedMarking = paperSections.length > 0 && paperSections.every(s => s?.marking && typeof s.marking.correct === 'number');
  const config = attemptDoc.paper?.schemaDriven || hasSnapshottedMarking
    ? attemptDoc.paper
    : getExamConfig(attemptDoc.configKey);
  if (!config) throw new Error(`Config not found: ${attemptDoc.configKey}`);

  const sectionResults = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const sectionConfig of config.sections) {
    const paperSection = paperSections.find(s => s.key === sectionConfig.key);
    if (!paperSection) continue;
    const marking = paperSection.marking && typeof paperSection.marking.correct === 'number'
      ? paperSection.marking
      : sectionConfig.marking;

    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    for (const q of paperSection.questions) {
      const userAnswer = attemptDoc.answers?.[q.id];
      const correctAnswer = attemptDoc.answerKey?.[q.id];

      if (isUnanswered(userAnswer)) {
        skipped++;
      } else if (mockAnswerCorrect(q, userAnswer, correctAnswer)) {
        correct++;
      } else {
        incorrect++;
      }
    }

    const sectionScore = (correct * marking.correct) - (incorrect * marking.incorrect);
    const sectionMax = Math.round((paperSection.questions.length * marking.correct) * 100) / 100;

    sectionResults.push({
      key: sectionConfig.key,
      label: sectionConfig.label,
      correct,
      incorrect,
      skipped,
      total: paperSection.questions.length,
      score: Math.round(sectionScore * 100) / 100,
      maxScore: sectionMax,
      accuracy: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 10000) / 100 : 0,
    });

    totalScore += sectionScore;
    maxScore += sectionMax;
  }

  const roundedTotal = Math.round(totalScore * 100) / 100;
  const roundedMax = Math.round(maxScore * 100) / 100;
  return {
    sections: sectionResults,
    totalScore: roundedTotal,
    maxScore: roundedMax,
    percentage: roundedMax > 0 ? Math.round((roundedTotal / roundedMax) * 10000) / 100 : 0,
  };
}

export async function computePercentile({
  examSlug,
  testId,
  score,
}) {
  try {
    const attempts =
      getMockAttemptsCollection();

    const baseFilter = {
      examSlug,
      testId,
      status: 'completed',
    };

    const numericScore = Number(score);
    const scoreKey = Number.isFinite(numericScore) ? Math.round(numericScore * 100) / 100 : 0;
    const keyPrefix = `meow:v1:mock-pct:${examSlug || ''}:${testId || ''}:`;

    const [
      countBelow,
      total,
    ] = await Promise.all([
      percentileCountCache.read(
        `${keyPrefix}lte:${scoreKey}`,
        () =>
          attempts.countDocuments(
            {
              ...baseFilter,
              'result.totalScore': {
                $lte: numericScore,
              },
            },
            { maxTimeMS: 2000 },
          ),
        { allowStale: true },
      ),
      percentileCountCache.read(
        `${keyPrefix}total`,
        () => attempts.countDocuments(baseFilter, { maxTimeMS: 2000 }),
        { allowStale: true },
      ),
    ]);

    return total > 0
      ? Math.min(100, Math.max(0, Math.round((countBelow / total) * 10000) / 100))
      : 50;
  } catch (err) {
    runtimeLog.warn(
      'Percentile computation failed:',
      err.message
    );

    return 50;
  }
}
