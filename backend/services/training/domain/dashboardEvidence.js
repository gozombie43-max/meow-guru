export function dashboardEvidence(session) {
  const rows = (session.result?.rows || []).filter(row => row.attempted);
  const correct = (session.questions || []).filter(question => session.answers?.[question.id]?.choice === question.correctIndex);
  return {
    version: 1,
    attempted: rows.length,
    speedSum: rows.reduce((sum, row) => sum + (row.correct ? Math.min(1, row.target / Math.max(1, row.seconds)) : 0), 0),
    correctCount: correct.length,
    difficultySum: correct.reduce((sum, question) => sum + question.difficulty / 5, 0),
  };
}
