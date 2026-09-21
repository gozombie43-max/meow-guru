export function getDailyMissionBlocks(intelligence) {
  const weak = intelligence.topics[0];
  
  const blocks = [
    {
      mode: "adaptive",
      count: 10,
      label: weak ? `Strengthen ${weak.topic}` : "Build your skill baseline",
      filter: (pool) => pool,
    },
    { 
      mode: "sprint", 
      count: 8, 
      label: "Train execution speed",
      filter: (pool) => pool,
    }
  ];

  if (intelligence.due && intelligence.due.length) {
    blocks.push({
      mode: "review",
      count: Math.min(5, intelligence.due.length),
      label: "Review due mistakes",
      filter: (pool, duePool) => duePool,
    });
  }

  blocks.push(
    { 
      mode: "section", 
      count: 10, 
      label: "Previous-year practice",
      filter: (pool) => pool.filter((q) => q.sourceType === "pyq"),
    },
    { 
      mode: "adaptive", 
      count: 9, 
      label: "Mixed consolidation",
      filter: (pool) => pool,
    }
  );

  return blocks;
}
