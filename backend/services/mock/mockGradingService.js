import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { mockAnswerIndex } from '../mockAnswer.js';
import { getExamConfig } from '../../config/exam-config.js';
import { getMockAttemptsCollection } from '../../config/mongodb.js';

export function gradeAttempt({ attemptDoc }) {
  const config = getExamConfig(attemptDoc.configKey);
  if (!config) throw new Error(`Config not found: ${attemptDoc.configKey}`);

  const sectionResults = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const sectionConfig of config.sections) {
    const paperSection = (attemptDoc.paper?.sections || []).find(s => s.key === sectionConfig.key);
    if (!paperSection) continue;

    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    for (const q of paperSection.questions) {
      const userAnswer = attemptDoc.answers?.[q.id];
      const correctAnswer = attemptDoc.answerKey?.[q.id];

      if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
        skipped++;
      } else if (Array.isArray(q.options) && q.options.length > 0
        ? mockAnswerIndex(correctAnswer, q.options) !== null && mockAnswerIndex(userAnswer, q.options, true) === mockAnswerIndex(correctAnswer, q.options)
        : correctAnswer != null && String(userAnswer) === String(correctAnswer)) {
        correct++;
      } else {
        incorrect++;
      }
    }

    const sectionScore = (correct * sectionConfig.marking.correct) - (incorrect * sectionConfig.marking.incorrect);
    const sectionMax = paperSection.questions.length * sectionConfig.marking.correct;

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

  return {
    sections: sectionResults,
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore,
    percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0,
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

    const [
      countBelow,
      total,
    ] = await Promise.all([
      attempts.countDocuments({
        ...baseFilter,
        'result.totalScore': {
          $lte: Number(score),
        },
      }),
      attempts.countDocuments(
        baseFilter
      ),
    ]);

    return total > 0
      ? Math.round(
          (
            countBelow /
            total
          ) * 10000
        ) / 100
      : 50;
  } catch (err) {
    runtimeLog.warn(
      'Percentile computation failed:',
      err.message
    );

    return 50;
  }
}
