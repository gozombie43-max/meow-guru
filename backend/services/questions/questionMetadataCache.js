import { getMongoDB } from "../../config/mongodb.js";

const COLLECTION = "questionMetadata";
const REVISION_ID = "revision";
// Recovery for imports performed outside the application write services.
const MAX_AGE_MS = 60 * 60 * 1000;
const pending = new Map();

export async function invalidateQuestionMetadata() {
  await getMongoDB().collection(COLLECTION).updateOne(
    { _id: REVISION_ID },
    { $inc: { revision: 1 } },
    { upsert: true },
  );
}

export async function readQuestionMetadata(params, build) {
  const collection = getMongoDB().collection(COLLECTION);
  const key = JSON.stringify({
    topic: params.topic || "", subject: params.subject || "", mode: params.mode || "",
    normalized: process.env.QUESTIONS_NORMALIZED_KEYS === "true", schema: 3,
  });
  const revision = (await collection.findOne({ _id: REVISION_ID }))?.revision ?? 0;
  const cached = await collection.findOne({ _id: key });
  if (cached?.revision === revision && Date.now() - new Date(cached.updatedAt).getTime() < MAX_AGE_MS) {
    return cached.data;
  }
  const pendingKey = `${key}:${revision}`;
  if (pending.has(pendingKey)) return pending.get(pendingKey);
  const work = (async () => {
    const data = await build();
    // A concurrent upload changes the revision. Older builds can never be reused
    // as current metadata, even across separate API/worker processes.
    await collection.updateOne({ _id: key }, {
      $set: { revision, data, params: { topic: params.topic, subject: params.subject, mode: params.mode }, updatedAt: new Date() },
    }, { upsert: true });
    return data;
  })();
  pending.set(pendingKey, work);
  try { return await work; }
  finally { pending.delete(pendingKey); }
}
