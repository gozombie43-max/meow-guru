import { selectQuestions } from "../../trainingEngine.js";
import { getDailyMissionBlocks } from "./missionBlocks.js";

export function planDailyMission({ intelligence, pool, duePool, now, exposureRows }) {
  let questions = [];
  const used = new Set();
  let blockNumber = 0;

  const blocks = getDailyMissionBlocks(intelligence);

  for (const blockConfig of blocks) {
    const blockId = `mission-${++blockNumber}-${blockConfig.mode}`;
    const sourcePool = blockConfig.filter(pool, duePool);
    const available = sourcePool.filter((q) => !used.has(q.id));
    
    const block = selectQuestions(
      available,
      blockConfig.mode,
      blockConfig.count,
      intelligence,
      now,
      exposureRows,
    );
    
    for (const q of block) {
      used.add(q.id);
      questions.push({
        ...q,
        trainingBlock: blockConfig.label,
        trainingBlockId: blockId,
        trainingMode: blockConfig.mode,
      });
    }
  }

  return questions;
}
