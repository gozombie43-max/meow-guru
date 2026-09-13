import "dotenv/config";
import { connectMongoDB, disconnectMongoDB } from "../config/mongodb.js";
const db = await connectMongoDB();
const docs = await db.collection("conceptGroupMetadata").find(
  { status: { $ne: "completed" } },
  { projection: { scope: 1, status: 1, attempts: 1, error: 1 } }
).toArray();
for (const d of docs) console.log(JSON.stringify(d));
console.log(`\nTotal non-completed: ${docs.length}`);

// Delete failed records so ensureConceptGroups re-inserts with fresh fingerprints
if (process.argv.includes("--clean")) {
  const r = await db.collection("conceptGroupMetadata").deleteMany({ status: "failed" });
  console.log(`Deleted ${r.deletedCount} failed records`);
}
await disconnectMongoDB();
