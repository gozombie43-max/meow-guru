import { normalizeQuestion, selectQuestions } from "../../trainingEngine.js";
import { dueTrainingQuestions } from "../../../repositories/trainingRepository.js";

export async function planDailyMission({ intelligence, pool, now, exposureRows, exam }) {
  let questions = [];
  const used = new Set();
  let blockNumber = 0;

  const add = (source, mode, count, label) => {
    const blockId = `mission-${++blockNumber}-${mode}`;
    const block = selectQuestions(
      source.filter((q) => !used.has(q.id)),
      mode,
      count,
      intelligence,
      now,
      exposureRows,
    );
    for (const q of block) {
      used.add(q.id);
      questions.push({
        ...q,
        trainingBlock: label,
        trainingBlockId: blockId,
        trainingMode: mode,
      });
    }
  };

  add(pool, "adaptive", 10, "Weak-area practice");
  add(pool, "sprint", 8, "Build your pace");

  // Review retrieval is separate so recently seen mistakes remain eligible.
  const dueDocs = await dueTrainingQuestions(exam, intelligence.due.map(r => r.questionId));
  add(
    dueDocs.map(normalizeQuestion).filter(Boolean),
    "review",
    5,
    "Due reviews",
  );

  add(
    pool.filter((q) => q.sourceType === "pyq"),
    "section",
    10,
    "Previous-year practice",
  );
  add(pool, "adaptive", 9, "Mixed consolidation");

  return questions;
}
