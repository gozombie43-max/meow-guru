import { mockAnswerIndex } from "./mockAnswer.js";

export const MODES = [
  "adaptive",
  "challenge",
  "sprint",
  "pressure",
  "section",
  "gauntlet",
  "nightmare",
  "survival",
];
export const MISTAKES = [
  "Concept Gap",
  "Calculation Error",
  "Misread",
  "Memory/Formula",
  "Bad Elimination",
  "Time Management",
  "Guessing",
];
export const EXAMS = ["ssc-cgl", "ssc-chsl", "cat"];
const DAY = 86400000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function normalizeQuestion(q) {
  if (
    !Array.isArray(q.options) ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(String(q.id || "")) ||
    ["__proto__", "constructor", "prototype"].includes(q.id)
  )
    return null;
  const options = (q.options || []).map((o) =>
    typeof o === "string" ? o : o?.text,
  );
  const correctIndex = mockAnswerIndex(q.correctAnswer, q.options);
  const text = q.question || q.questionText;
  if (
    !q.id ||
    !text ||
    options.length < 2 ||
    options.some((o) => typeof o !== "string" || !o.trim()) ||
    correctIndex === null
  )
    return null;
  if (q.sourceType === "ai-generated" && q.validationStatus !== "validated")
    return null;
  const difficulty =
    typeof q.difficulty === "number"
      ? clamp(q.difficulty, 1, 5)
      : { easy: 1, medium: 2, hard: 3, extreme: 4, nightmare: 5 }[
          String(q.difficulty).toLowerCase()
        ] || 2;
  return {
    id: String(q.id),
    text: String(text),
    options,
    correctIndex,
    solution: String(q.solution || q.explanation || ""),
    image: q.questionImage || q.image || "",
    subject: String(q.subject || "Unclassified"),
    topic: String(q.topic || q.questionTopic || "Unclassified"),
    subtopic: String(q.subtopic || q.chapter || ""),
    concepts: Array.isArray(q.concepts) ? q.concepts : [],
    difficulty,
    expectedTime: clamp(Number(q.expectedTime) || 60, 10, 600),
    targetSource: q.expectedTime ? "catalog" : "baseline",
    sourceType: q.sourceType || (q.year ? "pyq" : "bank"),
    year: q.year || null,
    shift: q.shift || null,
    discrimination: clamp(Number(q.discrimination) || 0, 0, 1),
  };
}

// Completed session snapshots are the durable event source. No client score is trusted.
export function buildIntelligence(sessions, now = Date.now()) {
  const skills = new Map(),
    reviews = new Map(),
    details = new Map();
  for (const s of [...sessions].sort(
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

export function readinessWithEvidence(
  intelligence,
  sessions,
  catalogTopics,
  mocks,
) {
  const rows = sessions
    .flatMap((s) => s.result?.rows || [])
    .filter((r) => r.attempted);
  const trained = new Set(intelligence.topics.map((p) => p.topic));
  const coverage = catalogTopics.length
    ? catalogTopics.filter((t) => trained.has(t)).length / catalogTopics.length
    : 0;
  const questions = sessions.flatMap((s) =>
    s.questions.filter((q) => s.answers[q.id]?.choice === q.correctIndex),
  );
  const difficulty = questions.length
    ? questions.reduce((n, q) => n + q.difficulty / 5, 0) / questions.length
    : 0;
  const mockScores = mocks
    .map((m) => m.result)
    .filter((r) => r && Number(r.maxScore) > 0)
    .map((r) => clamp(Number(r.totalScore) / Number(r.maxScore), 0, 1));
  const positive = sessions.reduce((n, s) => n + (s.result?.maxScore || 0), 0);
  const losses = sessions.reduce(
    (n, s) => n + (s.result?.negativeLoss || 0),
    0,
  );
  const factors = {
    ...intelligence.factors,
    catalogCoverage: Math.round(coverage * 100),
    difficulty: Math.round(difficulty * 100),
    mockPerformance: mockScores.length
      ? Math.round(
          (mockScores.reduce((n, v) => n + v, 0) / mockScores.length) * 100,
        )
      : 0,
    negativeMarking: rows.length
      ? Math.round((1 - Math.min(1, losses / Math.max(1, positive))) * 100)
      : 0,
  };
  const weights = {
    accuracy: 0.2,
    mastery: 0.2,
    speed: 0.15,
    catalogCoverage: 0.1,
    difficulty: 0.1,
    mockPerformance: 0.1,
    consistency: 0.1,
    negativeMarking: 0.05,
  };
  return {
    ...intelligence,
    factors,
    weights,
    readiness:
      intelligence.attempts >= 30
        ? Math.round(
            Object.entries(weights).reduce(
              (n, [key, weight]) => n + factors[key] * weight,
              0,
            ),
          )
        : null,
    evidence: `Provisional estimate from ${sessions.length} recent training sessions and ${mockScores.length} scored mocks. Coverage is against catalog topics, not a verified complete syllabus. Missing mock evidence contributes zero.`,
  };
}

export function selectQuestions(
  pool,
  mode,
  count,
  intelligence,
  now = Date.now(),
) {
  const skills = new Map(
    intelligence.topics.map((p) => [`${p.subject} / ${p.topic}`, p]),
  );
  const due = new Set(intelligence.due.map((r) => r.questionId));
  const ranked = pool
    .map((q) => {
      const p = skills.get(`${q.subject} / ${q.topic}`);
      const weakness = 1 - (p?.mastery ?? 0.5);
      const fit =
        1 / (1 + Math.abs(q.difficulty - (1 + (p?.mastery ?? 0.5) * 3)));
      const recency = p?.lastAt
        ? Math.min(1, (now - new Date(p.lastAt).getTime()) / (7 * DAY))
        : 1;
      let rank =
        weakness * 4 +
        fit * 2 +
        recency +
        Number(due.has(q.id)) * 4 +
        Number(q.sourceType === "pyq");
      if (mode === "sprint")
        rank =
          (p?.mastery ?? 0.5) * 4 +
          Math.max(0, (p?.seconds || q.expectedTime) / q.expectedTime - 1) * 3 -
          q.difficulty;
      if (["challenge", "nightmare", "survival"].includes(mode))
        rank += q.difficulty * 2 + q.discrimination * 2;
      if (mode === "review") rank = due.has(q.id) ? 100 : -100;
      return { q, rank };
    })
    .filter((r) => mode !== "review" || due.has(r.q.id))
    .sort((a, b) => b.rank - a.rank || a.q.id.localeCompare(b.q.id));
  const selected = [],
    topicCount = new Map();
  while (ranked.length && selected.length < count) {
    // Soft distribution constraint: penalize overrepresented topics at every pick.
    ranked.sort(
      (a, b) =>
        b.rank -
        (topicCount.get(b.q.topic) || 0) * 2 -
        (a.rank - (topicCount.get(a.q.topic) || 0) * 2),
    );
    const { q } = ranked.shift();
    const skill = skills.get(`${q.subject} / ${q.topic}`);
    selected.push(
      skill?.attempts >= 5
        ? {
            ...q,
            expectedTime: Math.round(
              clamp(
                skill.seconds * 0.9,
                q.expectedTime * 0.8,
                q.expectedTime * 1.5,
              ),
            ),
            targetSource: "personalized",
          }
        : q,
    );
    topicCount.set(q.topic, (topicCount.get(q.topic) || 0) + 1);
  }
  if (["challenge", "nightmare", "survival"].includes(mode))
    selected.sort((a, b) => a.difficulty - b.difficulty);
  if (mode === "gauntlet")
    selected.sort(
      (a, b) => a.topic.localeCompare(b.topic) || a.difficulty - b.difficulty,
    );
  return selected;
}

export function resultFor(s) {
  const rows = s.questions.map((q, index) => {
    const a = s.answers[q.id];
    const attempted = a?.choice !== null && a?.choice !== undefined;
    const correct = attempted && a.choice === q.correctIndex;
    return {
      questionId: q.id,
      number: index + 1,
      topic: q.topic,
      attempted,
      correct,
      choice: a?.choice ?? null,
      correctIndex: q.correctIndex,
      seconds: a?.seconds || 0,
      target: q.expectedTime,
      confidence: a?.confidence || null,
      mistake: a?.mistake || null,
      solution: q.solution,
      score: correct ? s.marking.correct : attempted ? -s.marking.wrong : 0,
    };
  });
  const attempted = rows.filter((r) => r.attempted),
    correct = attempted.filter((r) => r.correct).length;
  const findings = rows
    .filter((r) => !r.correct && r.seconds > r.target)
    .map(
      (r) =>
        `Q${r.number}: ${Math.round(r.seconds)}s invested without a correct answer; target ${r.target}s. Try an earlier skip.`,
    );
  const untouched = rows.filter(
    (r) => !r.attempted && s.questions[r.number - 1].difficulty <= 2,
  ).length;
  if (untouched)
    findings.push(
      `${untouched} easy/medium questions left unanswered. Scan these first next time.`,
    );
  const revisits =
    s.events.filter((e) => e.type === "visit").length -
    new Set(s.events.filter((e) => e.type === "visit").map((e) => e.questionId))
      .size;
  if (revisits > 0)
    findings.push(
      `${revisits} revisits. Check whether returning improved your final choices.`,
    );
  const last = attempted.filter(
    (r) =>
      (s.answers[r.questionId]?.at || 0) >=
      new Date(s.startedAt).getTime() + s.duration * 800,
  );
  if (last.length >= 3)
    findings.push(
      `Final fifth of the clock: ${Math.round((last.filter((r) => r.correct).length / last.length) * 100)}% accuracy across ${last.length} attempts.`,
    );
  let streak = 0,
    bestStreak = 0,
    modePoints = 0;
  for (const row of rows) {
    if (row.correct) {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      modePoints += Math.round(
        10 *
          s.questions[row.number - 1].difficulty *
          Math.min(2, row.target / Math.max(1, row.seconds)) *
          (1 + Math.min(streak, 10) / 10),
      );
    } else {
      streak = 0;
      if (s.mode === "sprint" && !row.attempted) modePoints -= 5;
    }
  }
  const elapsed = Math.max(
    1,
    (new Date(s.completedAt || s.deadline).getTime() -
      new Date(s.startedAt).getTime()) /
      60000,
  );
  const mastery = new Map();
  for (const row of rows.filter((r) => r.attempted)) {
    const q = s.questions[row.number - 1],
      key = `${q.subject} / ${q.topic}`;
    const before = s.baseline?.[key] ?? 0.5;
    const item = mastery.get(key) || {
      key,
      topic: q.topic,
      before,
      after: before,
    };
    item.after =
      0.8 * item.after +
      0.2 *
        (row.correct
          ? row.confidence === "guess"
            ? 0.25
            : row.confidence === "unsure"
              ? 0.6
              : 1
          : 0);
    mastery.set(key, item);
  }
  return {
    rows,
    masteryDelta: [...mastery.values()].map((p) => ({
      ...p,
      before: Math.round(p.before * 100),
      after: Math.round(p.after * 100),
      delta: Math.round((p.after - p.before) * 100),
    })),
    attempted: attempted.length,
    correct,
    accuracy: attempted.length
      ? Math.round((correct / attempted.length) * 100)
      : 0,
    modePoints: Math.max(0, modePoints),
    bestStreak,
    questionsPerMinute: Math.round((attempted.length / elapsed) * 100) / 100,
    score: rows.reduce((n, r) => n + r.score, 0),
    maxScore: s.questions.length * s.marking.correct,
    negativeLoss: attempted.filter((r) => !r.correct).length * s.marking.wrong,
    secondsSaved: Math.round(
      attempted.reduce((n, r) => n + r.target - r.seconds, 0),
    ),
    averageSeconds: attempted.length
      ? Math.round(
          attempted.reduce((n, r) => n + r.seconds, 0) / attempted.length,
        )
      : 0,
    findings,
    failureMap: Object.fromEntries(
      MISTAKES.map((m) => [m, rows.filter((r) => r.mistake === m).length]),
    ),
  };
}

export function publicSession(s, now = Date.now()) {
  return {
    id: s.id,
    mode: s.mode,
    exam: s.exam,
    revision: s.revision,
    status: s.status,
    current: s.current,
    duration: s.duration,
    deadline: s.deadline,
    serverNow: now,
    lastEventAt: s.lastEventAt,
    lives: s.lives,
    marking: s.marking,
    answers: s.answers,
    result: s.result || null,
    questions: s.questions.map(({ correctIndex, solution, ...q }) =>
      s.status === "completed" ? { ...q, correctIndex, solution } : q,
    ),
  };
}

export function transition(session, action, now = Date.now()) {
  const s = structuredClone(session);
  if (s.status === "completed") return s;
  const expired = now >= new Date(s.deadline).getTime();
  const q = s.questions[s.current];
  const elapsed = Math.max(
    0,
    (Math.min(now, new Date(s.deadline).getTime()) - s.lastEventAt) / 1000,
  );
  const a = s.answers[q.id] || { choice: null, seconds: 0, confidence: null };
  a.seconds += elapsed;
  s.answers[q.id] = a;
  s.lastEventAt = now;
  if (!expired && action.type === "answer") {
    if (
      action.choice !== null &&
      (!Number.isInteger(action.choice) ||
        action.choice < 0 ||
        action.choice >= q.options.length)
    )
      throw new Error("Invalid answer");
    if (
      action.confidence &&
      !["sure", "unsure", "guess"].includes(action.confidence)
    )
      throw new Error("Invalid confidence");
    a.choice = action.choice;
    a.confidence = action.confidence || null;
    a.at = now;
    s.events.push({ type: "answer", questionId: q.id, at: now });
    if (s.mode === "survival") {
      if (a.choice !== q.correctIndex) s.lives--;
      s.slowStreak =
        a.seconds > q.expectedTime * 1.5 ? (s.slowStreak || 0) + 1 : 0;
      if (s.slowStreak >= 2) {
        s.lives--;
        s.slowStreak = 0;
      }
    }
    if (!["pressure", "section"].includes(s.mode)) {
      if (
        s.mode === "gauntlet" &&
        !q.recoveryFor &&
        s.questions[s.current + 1]?.topic !== q.topic &&
        (s.recoveredTopics || []).length < 3 &&
        !(s.recoveredTopics || []).includes(q.topic)
      ) {
        const block = s.questions
          .slice(0, s.current + 1)
          .filter((item) => item.topic === q.topic);
        const accuracy =
          block.filter(
            (item) => s.answers[item.id]?.choice === item.correctIndex,
          ).length / block.length;
        if (block.length >= 3 && accuracy < 0.5) {
          const recovery = (s.reserve || [])
            .filter(
              (item) =>
                item.topic === q.topic && item.difficulty <= q.difficulty,
            )
            .slice(0, 2)
            .map((item) => ({
              ...item,
              recoveryFor: q.topic,
              trainingBlock: `Recovery: ${q.topic}`,
            }));
          if (recovery.length) {
            s.questions.splice(s.current + 1, 0, ...recovery);
            s.reserve = s.reserve.filter(
              (item) => !recovery.some((r) => r.id === item.id),
            );
            s.recoveredTopics = [...(s.recoveredTopics || []), q.topic];
          }
        }
      }
      if (s.current === s.questions.length - 1) action = { type: "finish" };
      else {
        s.current++;
        // Adapt within the already validated pool; scoring and question identities never change.
        if (["adaptive", "challenge", "nightmare"].includes(s.mode)) {
          const ceiling = s.mode === "nightmare" ? 3 : 1;
          const target = clamp(
            q.difficulty +
              (a.choice === q.correctIndex && a.confidence !== "guess"
                ? 1
                : -1),
            ceiling,
            5,
          );
          const remaining = s.questions.slice(s.current);
          remaining.sort(
            (x, y) =>
              Math.abs(x.difficulty - target) - Math.abs(y.difficulty - target),
          );
          // Every fifth challenger question is an easier reasoning check.
          if (s.mode === "challenge" && s.current % 5 === 4)
            remaining.sort((x, y) => x.difficulty - y.difficulty);
          s.questions.splice(s.current, remaining.length, ...remaining);
        }
      }
    }
  }
  if (!expired && action.type === "visit") {
    if (!["pressure", "section"].includes(s.mode))
      throw new Error("This mode moves forward only");
    if (
      !Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index >= s.questions.length
    )
      throw new Error("Invalid question");
    s.current = action.index;
    s.events.push({
      type: "visit",
      questionId: s.questions[s.current].id,
      at: now,
    });
  }
  if (expired || action.type === "finish" || s.lives <= 0) {
    s.status = "completed";
    s.completedAt = new Date(now).toISOString();
    s.result = resultFor(s);
  }
  s.revision++;
  return s;
}
