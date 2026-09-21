const DAY = 86400000;

export function buildIntelligence(sessions, now = Date.now(), durablePrimary = false) {
  const skills = new Map(),
    reviews = new Map(),
    details = new Map();
  for (const s of (durablePrimary ? [] : [...sessions]).sort(
    (a, b) => new Date(a.completedAt) - new Date(b.completedAt),
  )) {
    for (const q of s.questions) {
      const a = s.answers[q.id];
      if (!a || a.choice === null) continue;
      const correct = a.choice === q.correctIndex;
      const key = `${q.subject} / ${q.topic}`;
      const p = skills.get(key) || {
        key,
        subject: q.subject,
        topic: q.topic,
        attempts: 0,
        correct: 0,
        mastery: 0.5,
        seconds: q.expectedTime,
        lastAt: null,
      };
      p.attempts++;
      p.correct += Number(correct);
      p.mastery =
        0.8 * p.mastery +
        0.2 *
          (correct
            ? a.confidence === "guess"
              ? 0.25
              : a.confidence === "unsure"
                ? 0.6
                : 1
            : 0);
      p.seconds = 0.8 * p.seconds + 0.2 * a.seconds;
      p.lastAt = s.completedAt;
      skills.set(key, p);
      const detailKeys = [
        ...(q.subtopic ? [{ level: "subtopic", label: q.subtopic }] : []),
        ...(q.concepts || [])
          .filter((c) => typeof c === "string")
          .map((label) => ({ level: "concept", label })),
      ];
      for (const detail of detailKeys) {
        const detailKey = `${key} / ${detail.level} / ${detail.label}`;
        const item = details.get(detailKey) || {
          key: detailKey,
          ...detail,
          subject: q.subject,
          topic: q.topic,
          attempts: 0,
          correct: 0,
          mastery: 0.5,
          seconds: q.expectedTime,
        };
        item.attempts++;
        item.correct += Number(correct);
        item.mastery =
          0.8 * item.mastery +
          0.2 *
            (correct
              ? a.confidence === "guess"
                ? 0.25
                : a.confidence === "unsure"
                  ? 0.6
                  : 1
              : 0);
        item.seconds = 0.8 * item.seconds + 0.2 * a.seconds;
        item.lastAt = s.completedAt;
        details.set(detailKey, item);
      }
      const old = reviews.get(q.id);
      const risky =
        !correct ||
        a.confidence === "guess" ||
        a.confidence === "unsure" ||
        a.seconds > q.expectedTime * 1.5;
      if (risky || old) {
        const stage = risky ? 0 : Math.min((old?.stage || 0) + 1, 4);
        reviews.set(q.id, {
          questionId: q.id,
          topic: q.topic,
          stage,
          dueAt: new Date(
            new Date(s.completedAt).getTime() + [1, 3, 7, 21, 60][stage] * DAY,
          ).toISOString(),
          reason: !risky
            ? "Scheduled recall"
            : !correct
              ? a.confidence === "sure"
                ? "Wrong + Sure: possible misconception"
                : "Wrong answer"
              : a.seconds > q.expectedTime * 1.5
                ? "Above target time"
                : "Low confidence",
          mistake: a.mistake || null,
        });
      }
    }
  }
  const topics = [...skills.values()].sort((a, b) => a.mastery - b.mastery);
  const queue = [...reviews.values()].sort((a, b) =>
    a.dueAt.localeCompare(b.dueAt),
  );
  const attempts = topics.reduce((n, p) => n + p.attempts, 0);
  const accuracy = attempts
    ? topics.reduce((n, p) => n + p.correct, 0) / attempts
    : 0;
  const mastery = topics.length
    ? topics.reduce((n, p) => n + p.mastery, 0) / topics.length
    : 0;
  const rows = sessions
    .flatMap((s) => s.result?.rows || [])
    .filter((r) => r.attempted);
  const speed = rows.length
    ? rows.reduce(
        (n, r) =>
          n + (r.correct ? Math.min(1, r.target / Math.max(1, r.seconds)) : 0),
        0,
      ) / rows.length
    : 0;
  const consistency = Math.min(
    1,
    new Set(
      sessions
        .filter((s) => now - new Date(s.completedAt).getTime() <= 7 * DAY)
        .map((s) => String(s.completedAt).slice(0, 10)),
    ).size / 7,
  );
  const factors = {
    accuracy: Math.round(accuracy * 100),
    mastery: Math.round(mastery * 100),
    speed: Math.round(speed * 100),
    consistency: Math.round(consistency * 100),
  };
  return {
    topics,
    details: [...details.values()],
    reviews: queue,
    due: queue.filter((r) => new Date(r.dueAt).getTime() <= now),
    attempts,
    readiness:
      attempts >= 30
        ? Math.round(
            100 *
              (accuracy * 0.35 +
                mastery * 0.35 +
                speed * 0.2 +
                consistency * 0.1),
          )
        : null,
    factors,
    evidence:
      "Practice estimate from the latest 200 completed sessions; not an exam percentile. Syllabus coverage and mock evidence are not yet included.",
  };
}

export function mergeDurableIntelligence(
  intelligence,
  skillRows = [],
  reviewRows = [],
  now = Date.now(),
) {
  if (!skillRows.length && !reviewRows.length) return intelligence;

  const historicalTopics = new Map(
    intelligence.topics.map((item) => [item.key, item]),
  );
  const historicalDetails = new Map(
    (intelligence.details || []).map((item) => [item.key, item]),
  );

  const durableTopics = skillRows
    .filter((item) => item.level === "topic")
    .map((item) => {
      const historical = historicalTopics.get(item.key);
      return {
        key: item.key,
        subject: item.subject,
        topic: item.topic,
        attempts: Math.max(item.attempts || 0, historical?.attempts || 0),
        correct: Math.max(item.correct || 0, historical?.correct || 0),
        mastery: item.mastery,
        seconds: item.seconds,
        lastAt: item.lastAt,
      };
    });
  const durableTopicKeys = new Set(durableTopics.map((item) => item.key));
  const topics = [
    ...durableTopics,
    ...intelligence.topics.filter((item) => !durableTopicKeys.has(item.key)),
  ].sort((a, b) => a.mastery - b.mastery);

  const durableDetails = skillRows
    .filter((item) => item.level !== "topic")
    .map((item) => {
      const historical = historicalDetails.get(item.key);
      return {
        key: item.key,
        level: item.level,
        label: item.label,
        subject: item.subject,
        topic: item.topic,
        attempts: Math.max(item.attempts || 0, historical?.attempts || 0),
        correct: Math.max(item.correct || 0, historical?.correct || 0),
        mastery: item.mastery,
        seconds: item.seconds,
        lastAt: item.lastAt,
      };
    });
  const durableDetailKeys = new Set(durableDetails.map((item) => item.key));
  const details = [
    ...durableDetails,
    ...(intelligence.details || []).filter(
      (item) => !durableDetailKeys.has(item.key),
    ),
  ];

  const reviewMap = new Map(
    intelligence.reviews.map((item) => [String(item.questionId), item]),
  );
  for (const row of reviewRows) {
    const { _id, userId: _userId, exam: _exam, ...review } = row;
    reviewMap.set(String(review.questionId), review);
  }
  const reviews = [...reviewMap.values()].sort((a, b) =>
    a.dueAt.localeCompare(b.dueAt),
  );
  const attempts = topics.reduce((n, item) => n + item.attempts, 0);
  const mastery = topics.length
    ? topics.reduce((n, item) => n + item.mastery, 0) / topics.length
    : 0;

  return {
    ...intelligence,
    topics,
    details,
    reviews,
    due: reviews.filter((item) => new Date(item.dueAt).getTime() <= now),
    attempts,
    factors: {
      ...intelligence.factors,
      mastery: Math.round(mastery * 100),
      accuracy: attempts ? Math.round(topics.reduce((sum, item) => sum + item.correct, 0) / attempts * 100) : 0,
    },
  };
}
