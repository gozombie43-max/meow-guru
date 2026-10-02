import 'server-only';

export type PublicTopicCounts = { subject: string; revision: number; updatedAt: string; totals: Record<string, number> };
export async function getPublicTopicCounts(subject: string): Promise<PublicTopicCounts | null> {
  const backend = process.env.API_URL || process.env.AZURE_BACKEND_URL;
  if (!backend) return null;
  try {
    const response = await fetch(`${backend.replace(/\/+$/, '')}/api/questions/topic-counts?subject=${encodeURIComponent(subject)}`, {
      credentials: 'omit', next: { revalidate: 60, tags: ['question-catalog'] }, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const data = await response.json() as PublicTopicCounts;
    if (data.subject !== subject || !Number.isFinite(data.revision) || !data.totals || !Object.values(data.totals).every(n => Number.isInteger(n) && n >= 0)) return null;
    // Whitelist only shared data. Cookies, credentials and user progress never enter this cache.
    return { subject: data.subject, revision: data.revision, updatedAt: data.updatedAt, totals: data.totals };
  } catch { return null; }
}
