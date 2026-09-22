const DAY = 86400000;
const REVIEW_INTERVALS = [1, 3, 7, 21, 60];

const answerSignal = (correct, confidence) =>
  correct ? (confidence === 'guess' ? 0.25 : confidence === 'unsure' ? 0.6 : 1) : 0;

const skillKeysFor = question => [
  {
    key: `${question.subject} / ${question.topic}`,
    level: 'topic',
    label: question.topic,
    subject: question.subject,
    topic: question.topic,
  },
  ...(question.subtopic ? [{
    key: `${question.subject} / ${question.topic} / subtopic / ${question.subtopic}`,
    level: 'subtopic', label: question.subtopic, subject: question.subject, topic: question.topic,
  }] : []),
  ...(question.concepts || []).filter(concept => typeof concept === 'string' && concept.trim()).map(label => ({
    key: `${question.subject} / ${question.topic} / concept / ${label}`,
    level: 'concept', label, subject: question.subject, topic: question.topic,
  })),
];

const reviewReason = (correct, answer, question) =>
  !correct
    ? answer.confidence === 'sure' ? 'Wrong + Sure: possible misconception' : 'Wrong answer'
    : answer.seconds > question.expectedTime * 1.5 ? 'Above target time' : 'Low confidence';

export function createLearnerState({ skillRows = [], reviewRows = [], exposureRows = [] } = {}) {
  return {
    skills: new Map(skillRows.map(row => [row.key, { ...row }])),
    reviews: new Map(reviewRows.map(row => [String(row.questionId), { ...row }])),
    exposures: new Map(exposureRows.map(row => [String(row.questionId), { ...row }])),
  };
}

// This is deliberately pure: both a live completion and a historical rebuild
// advance the exact same state machine in chronological session order.
export function applySessionToLearnerState(state, completed) {
  if (!completed?.result || completed.status !== 'completed') return state;
  const completedAt = completed.completedAt;
  for (const question of completed.questions || []) {
    const answer = completed.answers?.[question.id];
    if (!answer || answer.choice === null) continue;

    const correct = answer.choice === question.correctIndex;
    const risky = !correct || answer.confidence === 'guess' || answer.confidence === 'unsure' ||
      answer.seconds > question.expectedTime * 1.5;
    const questionId = String(question.id);
    const exposure = state.exposures.get(questionId) || { questionId: question.id, timesSeen: 0, timesCorrect: 0 };
    state.exposures.set(questionId, {
      ...exposure,
      questionId: question.id,
      timesSeen: (exposure.timesSeen || 0) + 1,
      timesCorrect: (exposure.timesCorrect || 0) + Number(correct),
      lastSeenAt: completedAt,
      lastCorrect: correct,
      lastSeconds: answer.seconds,
      lastConfidence: answer.confidence || null,
    });

    const existingReview = state.reviews.get(questionId);
    const priorStage = existingReview?.stage ??
      (Number.isInteger(question.priorReviewStage) ? question.priorReviewStage : null);
    if (risky || existingReview || priorStage !== null) {
      const stage = risky ? 0 : Math.min((priorStage || 0) + 1, 4);
      state.reviews.set(questionId, {
        ...existingReview,
        questionId: question.id,
        topic: question.topic,
        stage,
        dueAt: new Date(new Date(completedAt).getTime() + REVIEW_INTERVALS[stage] * DAY).toISOString(),
        reason: risky ? reviewReason(correct, answer, question) : 'Scheduled recall',
        mistake: answer.mistake || existingReview?.mistake || null,
        lastSessionId: completed.id,
      });
    }

    for (const metadata of skillKeysFor(question)) {
      const existingSkill = state.skills.get(metadata.key);
      const skill = existingSkill || {
        ...metadata,
        attempts: 0,
        correct: 0,
        mastery: (metadata.level === 'topic' ? completed.baseline?.[metadata.key] : undefined) ?? 0.5,
        seconds: 60,
      };
      state.skills.set(metadata.key, {
        ...skill,
        ...metadata,
        attempts: (skill.attempts || 0) + 1,
        correct: (skill.correct || 0) + Number(correct),
        mastery: 0.8 * skill.mastery + 0.2 * answerSignal(correct, answer.confidence),
        seconds: 0.8 * skill.seconds + 0.2 * answer.seconds,
        lastAt: completedAt,
      });
    }
  }
  return state;
}

export function learnerStateDocuments(state, userId, exam, now = new Date()) {
  const stamp = row => ({
    ...row,
    userId,
    exam,
    createdAt: row.createdAt || now,
    updatedAt: now,
  });
  return {
    skillRows: [...state.skills.values()].map(row => stamp({ ...row, _id: `${userId}:${exam}:${row.key}` })),
    reviewRows: [...state.reviews.values()].map(row => stamp({ ...row, _id: `${userId}:${exam}:${row.questionId}` })),
    exposureRows: [...state.exposures.values()].map(row => stamp({ ...row, _id: `${userId}:${exam}:${row.questionId}` })),
  };
}

export function learnerStateKeysForSession(completed) {
  const attempted = (completed?.questions || []).filter(question => {
    const answer = completed.answers?.[question.id];
    return answer && answer.choice !== null;
  });
  return {
    questionIds: attempted.map(question => question.id),
    skillIds: attempted.flatMap(question => skillKeysFor(question).map(skill => `${completed.userId}:${completed.exam}:${skill.key}`)),
  };
}
