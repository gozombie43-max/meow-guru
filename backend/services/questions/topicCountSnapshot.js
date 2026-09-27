import { getMongoDB } from "../../config/mongodb.js";
import { getQuestionRevision, isNormalizedQuestionKeysEnabled } from "./questionCache.js";
import { fetchQuestionCounts } from "./questionMetadataService.js";

// Canonical mathematics hub topics. Counts use the same mode resolver as topic pages.
const TOPICS = [
  "percentages", "ratio-and-proportion", "profit-and-loss", "simple-interest",
  "compound-interest", "time-and-work", "time-and-distance", "algebra", "geometry",
  "mensuration", "trigonometry", "number-system", "averages", "discount",
  "mixture-and-alligation", "partnership", "square-roots", "statistics-probability",
];
const MODES = ["concept", "formula", "mixed", "aiChallenge", "easy", "hard"];
const pending = new Map();

export async function fetchTopicCountSnapshot(subject = "mathematics") {
  if (subject !== "mathematics") {
    const error = new Error("Unsupported topic-count subject");
    error.statusCode = 400;
    throw error;
  }
  const collection = getMongoDB().collection("questionMetadata");
  const id = `topic-counts:v1:${subject}:${isNormalizedQuestionKeysEnabled()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await getQuestionRevision();
    const cached = await collection.findOne({ _id: id });
    if (cached?.revision === revision) return cached.data;
    const key = `${id}:${revision}`;
    if (!pending.has(key)) {
      const work = (async () => {
        const totals = {};
        // Bounded concurrency; only runs at initialization or after question writes.
        for (let offset = 0; offset < TOPICS.length; offset += 4) {
          await Promise.all(TOPICS.slice(offset, offset + 4).map(async topic => {
            const counts = await fetchQuestionCounts({ subject, topic });
            totals[topic] = MODES.reduce((sum, mode) => sum + (counts[mode] ?? 0), 0);
          }));
        }
        if (await getQuestionRevision() !== revision) return null;
        const data = { subject, revision, totals, updatedAt: new Date().toISOString() };
        const snapshot = { _id: id, revision, data, kind: "topic-counts" };
        // An older worker must never overwrite a newer snapshot.
        await collection.updateOne({ _id: id }, [{ $replaceWith: {
          $cond: [{ $gt: [{ $ifNull: ["$revision", -1] }, revision] }, "$$ROOT", { $literal: snapshot }],
        } }], { upsert: true });
        return data;
      })();
      pending.set(key, work);
      work.finally(() => pending.delete(key)).catch(() => {});
    }
    const data = await pending.get(key);
    if (data && await getQuestionRevision() === data.revision) return data;
  }
  const error = new Error("Question counts are updating; please retry");
  error.statusCode = 503;
  throw error;
}
