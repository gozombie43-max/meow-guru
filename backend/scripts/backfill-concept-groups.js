import "dotenv/config";
import { connectMongoDB, disconnectMongoDB } from "../config/mongodb.js";
import { deriveModeKey, normalizeSearchKey } from "../services/questions/questionNormalizer.js";
import { fetchQuestionsMeta } from "../services/questions/questionMetadataService.js";
import { GROUPING_COLLECTION } from "../services/questions/conceptGroupService.js";
import { processConceptGroupingJob } from "../services/conceptGroupingWorker.js";

const apply = process.argv.includes("--apply");
const run = process.argv.includes("--run");
const retry = process.argv.includes("--retry-failed");
const db = await connectMongoDB();
try {
  const scopes = new Map();
  let unscoped = 0;
  const projection = { subject: 1, topic: 1, quizName: 1, quizId: 1, source: 1, questionType: 1, word: 1, meanings: 1, letter: 1 };
  for await (const q of db.collection("questions").find({}, { projection })) {
    if (!q.subject || !q.topic) { unscoped++; continue; }
    const params = { subject: String(q.subject).toLowerCase(), topic: q.topic, mode: deriveModeKey(q) };
    const key = JSON.stringify({ ...params, subject: normalizeSearchKey(params.subject) });
    scopes.set(key, params);
  }
  console.log(JSON.stringify({ stage: "inventory", scopes: scopes.size, unscoped, apply }));
  if (apply) {
    for (const params of scopes.values()) {
      const meta = await fetchQuestionsMeta(params);
      console.log(JSON.stringify({ stage: "metadata", ...params, questions: meta.total, concepts: meta.concepts.length, status: meta.groupingStatus }));
    }
    if (retry) await db.collection(GROUPING_COLLECTION).updateMany({ status: "failed" }, { $set: { status: "queued", attempts: 0, availableAt: new Date() }, $unset: { error: "" } });
    if (run) {
      // Two independent leases, bounded provider concurrency, persisted retries.
      const drain = async () => {
        while (true) {
          const result = await processConceptGroupingJob();
          if (result) { console.log(JSON.stringify(result)); continue; }
          const queued = await db.collection(GROUPING_COLLECTION).countDocuments({ status: "queued", attempts: { $lt: 3 } });
          if (!queued) break;
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      };
      await Promise.all([drain(), drain()]);
    }
    const summary = await db.collection(GROUPING_COLLECTION).aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray();
    console.log(JSON.stringify({ stage: "summary", summary }));
    if (summary.some(row => row._id === "failed" && row.count)) process.exitCode = 1;
  }
} finally { await disconnectMongoDB(); }
