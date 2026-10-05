import { getMongoDB } from '../config/mongodb.js';
import { claimJob, completeJob, renewJob, failJob } from '../infrastructure/durableQueue.js';
import { logger } from '../infrastructure/logger.js';

const options = { allowDiskUse: true, maxTimeMS: 120000 };
const countIf = condition => ({ $sum: { $cond: [condition, 1, 0] } });
const ratio = (a, b) => b ? a / b : 0;

// Exact nearest-rank percentiles without loading observations into Node memory.
async function distribution(collection, match, stages, expression) {
  const rows = await collection.aggregate([
    { $match: match }, ...stages,
    { $project: { value: { $convert: { input: expression, to: 'double', onError: null, onNull: null } } } },
    { $match: { value: { $ne: null, $gte: -Number.MAX_VALUE, $lte: Number.MAX_VALUE } } },
    { $setWindowFields: { sortBy: { value: 1 }, output: { rank: { $documentNumber: {} }, n: { $count: {}, window: { documents: ['unbounded', 'unbounded'] } } } } },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$value' },
      p50: { $max: { $cond: [{ $eq: ['$rank', { $ceil: { $multiply: ['$n', 0.5] } }] }, '$value', null] } },
      p95: { $max: { $cond: [{ $eq: ['$rank', { $ceil: { $multiply: ['$n', 0.95] } }] }, '$value', null] } },
    } },
  ], options).toArray();
  return rows[0] || { count: 0, average: null, p50: null, p95: null };
}

export async function buildBattleAnalytics(db, days, now = new Date()) {
  const since = new Date(+now - days * 86400000), matches = db.collection('battleMatches');
  const filter = { finishedAt: { $gte: since, $lte: now } };
  const daily = await matches.aggregate([
    { $match: filter },
    { $group: { _id: { $dateToString: { date: '$finishedAt', format: '%Y-%m-%d', timezone: 'UTC' } },
      total: { $sum: 1 }, completed: countIf({ $eq: ['$finishReason', 'completed'] }),
      forfeits: countIf({ $eq: ['$finishReason', 'forfeit'] }), abandoned: countIf({ $eq: ['$finishReason', 'abandoned'] }),
      matchmakingTotal: countIf({ $eq: ['$origin', 'matchmaking'] }),
      matched: countIf({ $and: [{ $eq: ['$origin', 'matchmaking'] }, { $ne: [{ $ifNull: ['$matchmaking', null] }, null] }] }),
      rematches: countIf({ $and: [{ $eq: ['$origin', 'rematch'] }, { $ne: [{ $ifNull: ['$rematchOfRoomCode', null] }, null] }] }),
    } },
  ], options).toArray();
  const totals = daily.reduce((sum, row) => { for (const key of ['total', 'completed', 'forfeits', 'abandoned', 'matchmakingTotal', 'matched', 'rematches']) sum[key] = (sum[key] || 0) + row[key]; return sum; }, {});
  const answerStages = [{ $unwind: '$players' }, { $unwind: '$players.answerLog' }];
  const [answer] = await matches.aggregate([{ $match: filter }, ...answerStages,
    { $group: { _id: null, answers: { $sum: 1 }, correct: countIf({ $eq: ['$players.answerLog.correct', true] }), timeouts: countIf({ $eq: ['$players.answerLog.timedOut', true] }) } },
  ], options).toArray();
  const durations = await distribution(matches, filter, [], '$durationMs');
  const matchedFilter = { ...filter, origin: 'matchmaking', matchmaking: { $ne: null } };
  const waits = await distribution(matches, matchedFilter, [{ $unwind: '$matchmaking.players' }], '$matchmaking.players.waitMs');
  const gaps = await distribution(matches, matchedFilter, [], '$matchmaking.ratingDifference');
  const responses = await distribution(matches, filter, answerStages, '$players.answerLog.responseTimeMs');
  const season = await db.collection('battleSeasons').findOne({ status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } });
  const rating = await db.collection('battleProfiles').aggregate([{ $match: { gamesPlayed: { $gt: 0 } } }, { $bucket: { groupBy: '$rating', boundaries: [0,1000,1100,1200,1300,1400,1500,1600,1800,2200,5000], default: 'other', output: { players: { $sum: 1 } } } }], options).toArray();
  const tiers = season ? await db.collection('battleSeasonProfiles').aggregate([{ $match: { seasonKey: season.key, gamesPlayed: { $gte: 5 } } }, { $group: { _id: '$tier', players: { $sum: 1 } } }], options).toArray() : [];
  return { daily, data: {
    window: { days, since, generatedAt: now },
    matches: { totalMatches: totals.total || 0, completionRate: ratio(totals.completed, totals.total), forfeitRate: ratio(totals.forfeits, totals.total), abandonedRate: ratio(totals.abandoned, totals.total), averageDurationMs: durations.average, p50DurationMs: durations.p50, p95DurationMs: durations.p95 },
    matchmaking: { matchedBattles: totals.matched || 0, averageQueueMs: waits.average, p50QueueMs: waits.p50, p95QueueMs: waits.p95, averageRatingGap: gaps.average, p50RatingGap: gaps.p50, p95RatingGap: gaps.p95 },
    rematches: { eligibleMatches: (totals.completed || 0) + (totals.forfeits || 0), rematches: totals.rematches || 0 },
    questions: { answers: answer?.answers || 0, correct: answer?.correct || 0, accuracy: ratio(answer?.correct, answer?.answers), timeoutRate: ratio(answer?.timeouts, answer?.answers), averageResponseMs: responses.average },
    distributions: { rating, tier: { season: season ? { key: season.key, name: season.name } : null, tiers } },
    telemetryCoverage: { duration: ratio(durations.count, totals.total), matchmaking: ratio(totals.matched || 0, totals.matchmakingTotal) },
  } };
}

export async function runBattleAnalyticsOnce(db = getMongoDB()) {
  const jobs = db.collection('runtimeJobs');
  const job = await claimJob(jobs, 'battle-analytics', new Date(), 180000);
  if (!job) return false;
  const generatedAt = new Date();
  let owned = true;
  const renewal = setInterval(() => { void renewJob(jobs, job, new Date(), 180000).then(value => { owned = owned && value; }).catch(() => { owned = false; }); }, 30000);
  try {
    const { data, daily } = await buildBattleAnalytics(db, job.days, generatedAt);
    if (!owned || !await renewJob(jobs, job, new Date(), 180000)) throw new Error('Analytics job lease lost');
    // Window-scoped days retain exact partial-day boundaries, with replacement replay semantics.
    for (const row of daily) await db.collection('battleAnalyticsDaily').updateOne({ _id: `${job.days}:${row._id}` }, [{ $replaceWith: { $cond: [{ $gt: [{ $ifNull: ['$generatedAt', new Date(0)] }, generatedAt] }, '$$ROOT', { $literal: { ...row, _id: `${job.days}:${row._id}`, days: job.days, date: row._id, generatedAt } }] } }], { upsert: true });
    await db.collection('battleAnalyticsSnapshots').updateOne({ _id: job.days }, [{ $replaceWith: { $cond: [{ $gt: [{ $ifNull: ['$generatedAt', new Date(0)] }, generatedAt] }, '$$ROOT', { $literal: { _id: job.days, generatedAt, data } }] } }], { upsert: true });
    await completeJob(jobs, job, { days: job.days });
    return true;
  } catch (error) { await failJob(jobs, job); throw error; }
  finally { clearInterval(renewal); }
}

let timer, running;
export function startBattleAnalyticsWorker() {
  if (timer) return;
  const tick = () => { if (!running) running = runBattleAnalyticsOnce().catch(error => logger.error({ err: error }, 'battle analytics failed')).finally(() => { running = undefined; }); };
  timer = setInterval(tick, 5000); timer.unref(); tick();
}
export function stopBattleAnalyticsWorker() { clearInterval(timer); timer = undefined; }
export async function waitForBattleAnalyticsIdle() { await running; return true; }
