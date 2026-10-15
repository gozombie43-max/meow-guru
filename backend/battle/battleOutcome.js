export function battleDecision(room) {
  const [a, b] = room.players || [];
  const draw = { winnerUserId: null, loserUserId: null, outcomeReason: 'draw' };
  if (!a || !b || room.finishReason === 'abandoned') return draw;
  if (room.finishReason === 'forfeit') return { winnerUserId: room.winnerUserId || null, loserUserId: room.loserUserId || null, outcomeReason: 'forfeit' };
  let difference = (a.score || 0) - (b.score || 0), outcomeReason = 'score';
  const totalTime = player => {
    const logs = player.answerLog || [], count = room.questions?.length || room.questionCount;
    if (!count || logs.length !== count || new Set(logs.map(entry => entry.questionIndex)).size !== count
      || logs.some(entry => !Number.isFinite(entry.responseTimeMs) || entry.responseTimeMs < 0)) return null;
    return logs.reduce((total, entry) => total + entry.responseTimeMs, 0);
  };
  const timeA = totalTime(a), timeB = totalTime(b);
  if (!difference && room.mode === 'ranked' && timeA !== null && timeB !== null) {
    difference = timeB - timeA;
    outcomeReason = 'response-time';
  }
  const timing = { responseTimes: { [a.userId]: timeA, [b.userId]: timeB } };
  if (!difference) return { ...draw, ...timing };
  return { winnerUserId: difference > 0 ? a.userId : b.userId, loserUserId: difference > 0 ? b.userId : a.userId, outcomeReason, ...timing };
}
