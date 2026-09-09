import { getMongoDB } from '../config/mongodb.js';
import { assertMigrations } from '../migrations/runner.js';
export async function checkReadiness() {
  const db = getMongoDB();
  await db.command({ ping: 1 }, { timeoutMS: 2000 });
  await assertMigrations(db);
}
