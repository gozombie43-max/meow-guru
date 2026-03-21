// backend/schema.js

export const createQuestion = ({
  gid, question, options, answer,
  solution = "",
  year, exam, tier,
  topic, category,
  difficulty = "medium",
  tags = []
}) => ({
  id: `${exam.toLowerCase().replace(/\s+/g, '-')}-${tier.toLowerCase().replace(/\s+/g, '-')}-${topic.toLowerCase()}-${gid}`,
  gid,
  question,
  options,       // string[4]
  answer,        // number: index 0–3
  solution,      // string (empty for now, fill later)
  year,          // "2013"
  exam,          // "SSC CGL"
  tier,          // "Tier-II"
  topic,         // "Algebra"
  category,      // "Maths"
  difficulty,    // "easy" | "medium" | "hard"
  tags,          // string[]
});