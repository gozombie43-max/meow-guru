import { normalizeTrainingSubject } from "../../trainingSubjects.js";
import { getTrainingModePolicy } from "../../trainingModePolicy.js";
import { getStrategy } from "./modeStrategies.js";

const DAY = 86400000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function selectQuestions(
  pool,
  mode,
  count,
  intelligence,
  now = Date.now(),
  exposureRows = [],
) {
  const strategy = getStrategy(mode);
  const topicKey = (q) => JSON.stringify([normalizeTrainingSubject(q.subject), q.topic]);
  const skills = new Map();
  for (const p of intelligence.topics) {
    const key = topicKey(p);
    const old = skills.get(key);
    const attempts = Math.max(0, Number(p.attempts) || 0);
    const total = (old?.attempts || 0) + attempts;
    const weight = total ? attempts / total : 1;
    skills.set(key, {
      attempts: total,
      mastery: (old?.mastery ?? 0.5) * (1 - weight) + clamp(p.mastery ?? 0.5, 0, 1) * weight,
      seconds: (old?.seconds ?? 60) * (1 - weight) + (p.seconds || 60) * weight,
      lastAt: Math.max(old?.lastAt || 0, Date.parse(p.lastAt) || 0),
    });
  }
  const masteryFor = (skill) => 0.5 + ((skill?.mastery ?? 0.5) - 0.5) * Math.min(1, (skill?.attempts || 0) / 10);
  const due = new Set(intelligence.due.map((r) => String(r.questionId)));
  const exposure = new Map(
    exposureRows.map((row) => [String(row.questionId), row]),
  );
  const floor = getTrainingModePolicy(mode).minDifficulty;
  
  const ranked = [...new Map(pool.map(q => [String(q.id), q])).values()]
    .filter(q => q.difficulty >= floor)
    .map((q) => {
      const p = skills.get(topicKey(q));
      const mastery = masteryFor(p);
      const weakness = 1 - mastery;
      const recency = p?.lastAt
        ? clamp((now - p.lastAt) / (7 * DAY), 0, 1)
        : 1;
      
      let rank = strategy.rankCandidate(q, {
        weakness,
        recency,
        isDue: due.has(String(q.id)),
        mastery,
        p,
      });

      if (mode !== "review") {
        const seen = exposure.get(String(q.id));
        if (seen) {
          const ageDays = Math.max(
            0,
            (now - (Date.parse(seen.lastSeenAt) || 0)) / DAY,
          );
          rank -= Math.log1p(Number(seen.timesSeen) || 1) * 1.5;
          if (ageDays < 1) rank -= 6;
          else if (ageDays < 7) rank -= 3 * (1 - ageDays / 7);
        }
      }
      return { q, rank, mastery };
    })
    .filter((r) => mode !== "review" || due.has(String(r.q.id)))
    .sort((a, b) => b.rank - a.rank || a.q.id.localeCompare(b.q.id));
    
  const selected = [],
    topicCount = new Map(),
    subjectCount = new Map();
  const targetCount = Math.min(count, ranked.length);
  
  const score = ({ q, rank, mastery }) => {
    const position = selected.length;
    const progress = targetCount > 1 ? position / (targetCount - 1) : 0;
    const ability = 1 + mastery * 3;
    
    const target = strategy.targetDifficulty({ ability, position, progress });
    
    const difficultyFit = strategy.ignoreDifficultyFit ? 0 : 4 / (1 + Math.abs(q.difficulty - clamp(target, floor, 5)));
    return rank + difficultyFit
      - (topicCount.get(topicKey(q)) || 0) * 2
      - (subjectCount.get(normalizeTrainingSubject(q.subject)) || 0) * 2;
  };
  
  while (ranked.length && selected.length < count) {
    let best = 0;
    let bestScore = score(ranked[0]);
    for (let i = 1; i < ranked.length; i++) {
      const candidateScore = score(ranked[i]);
      if (candidateScore > bestScore) {
        best = i;
        bestScore = candidateScore;
      }
    }
    const { q } = ranked.splice(best, 1)[0];
    const skill = skills.get(topicKey(q));
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
    topicCount.set(topicKey(q), (topicCount.get(topicKey(q)) || 0) + 1);
    const subject = normalizeTrainingSubject(q.subject);
    subjectCount.set(subject, (subjectCount.get(subject) || 0) + 1);
  }
  
  if (strategy.orderQuestions) {
    strategy.orderQuestions(selected, { masteryFor, skills, topicKey });
  }
  
  return selected;
}
