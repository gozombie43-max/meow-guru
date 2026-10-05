import { getMongoDB } from '../config/mongodb.js';

export async function enqueueBattleAnalytics(days, { db = getMongoDB(), session, now = new Date() } = {}) {
  const safeDays = Math.min(90, Math.max(1, Math.floor(Number(days) || 7)));
  const key = `battle-analytics:${safeDays}:${Math.floor(+now / 30000)}`;
  await db.collection('runtimeJobs').updateOne({ _id: key }, { $setOnInsert: {
    kind: 'battle-analytics', days: safeDays, status: 'queued', attempts: 0,
    availableAt: now, expiresAt: new Date(+now + 86400000),
  } }, { upsert: true, session });
  return safeDays;
}

export async function getBattleCompetitiveHealth(days = 7) {
  const db = getMongoDB();
  const safeDays = Math.min(90, Math.max(1, Math.floor(Number(days) || 7)));
  const snapshot = await db.collection('battleAnalyticsSnapshots').findOne({ _id: safeDays });
  const stale = !snapshot || Date.now() - new Date(snapshot.generatedAt).getTime() >= 30000;
  if (stale) await enqueueBattleAnalytics(safeDays);
  if (!snapshot) return { pending: true, days: safeDays, retryAfter: 5 };
  return { ...snapshot.data, freshness: { generatedAt: snapshot.generatedAt, stale } };
}
