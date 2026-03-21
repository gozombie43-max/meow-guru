const { readQuestions } = require('../database/db');

// Count occurrences and sort descending
function frequency(items) {
  const map = {};
  for (const item of items) {
    if (item) map[item] = (map[item] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function analyze() {
  const questions = readQuestions();
  const total = questions.length;

  // Topic frequency (uses topic, chapter, or "Uncategorized")
  const topics = questions.map(q => q.chapter || 'Uncategorized');
  const topicFrequency = frequency(topics);

  // Concept frequency
  const concepts = questions.map(q => q.concept).filter(Boolean);
  const conceptFrequency = frequency(concepts);

  // Difficulty distribution
  const difficulties = questions.map(q => q.difficulty || 'unset');
  const diffMap = {};
  for (const d of difficulties) diffMap[d] = (diffMap[d] || 0) + 1;
  const difficultyDistribution = Object.entries(diffMap).map(([level, count]) => ({
    level,
    count,
    percent: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0
  }));

  // Formula usage
  const withFormula = questions.filter(q => q.formula && q.formula.trim());
  const formulaUsage = {
    withFormula: withFormula.length,
    withoutFormula: total - withFormula.length,
    formulas: frequency(withFormula.map(q => q.formula))
  };

  // Trap types
  const traps = questions.map(q => q.trapType).filter(Boolean);
  const trapTypes = frequency(traps);

  // Subject breakdown
  const subjects = questions.map(q => q.subject || 'Unknown');
  const subjectFrequency = frequency(subjects);

  return {
    totalQuestions: total,
    subjectFrequency,
    topicFrequency,
    conceptFrequency,
    difficultyDistribution,
    formulaUsage,
    trapTypes
  };
}

module.exports = { analyze };
