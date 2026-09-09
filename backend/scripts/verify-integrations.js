// Explicit live smoke: one small billable model call, read-only storage and DB.
// Provide credentials through the environment; never writes provider data or logs secrets.
if (process.env.LIVE_INTEGRATION_CHECK !== '1') throw new Error('Set LIVE_INTEGRATION_CHECK=1 to run live checks');
const checks = [];
async function check(name, fn) {
  if (process.env.LIVE_CHECK_ONLY && process.env.LIVE_CHECK_ONLY !== name) return;
  const started = performance.now();
  try {
    const details = await fn();
    checks.push({ name, ok: true, durationMs: Math.round(performance.now() - started), ...details });
  } catch (error) {
    checks.push({ name, ok: false, durationMs: Math.round(performance.now() - started), errorType: error.name, code: /^[A-Z0-9_]+$/.test(String(error.code)) ? error.code : null, status: error.status ?? error.$metadata?.httpStatusCode ?? null });
  }
}
await check('ai-text', async () => {
  const { chatComplete } = await import('../ai/azureClient.js');
  const reply = await chatComplete('Reply with only the word READY.', 'o4-mini', null, 128);
  if (reply.trim() !== 'READY') throw new Error('Unexpected model reply');
  return { responseValidated: true, maxCompletionTokens: 128 };
});
await check('storage-read', async () => {
  const { ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { b2Client, B2_BUCKET } = await import('../config/b2.js');
  try {
    const objects = await b2Client.send(new ListObjectsV2Command({ Bucket: B2_BUCKET, MaxKeys: 1 }), { abortSignal: AbortSignal.timeout(15000) });
    const key = objects.Contents?.find(object => object.Size > 0)?.Key;
    if (!key) throw new Error('No nonempty object available for read verification');
    const result = await b2Client.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: key, Range: 'bytes=0-63' }), { abortSignal: AbortSignal.timeout(15000) });
    const bytes = await result.Body.transformToByteArray();
    if (!bytes.length) throw new Error('Empty storage read');
    return { rangeReadBytes: bytes.length };
  } finally { b2Client.destroy(); }
});
await check('database-readiness', async () => {
  if (process.env.MONGODB_DNS_SERVERS) {
    const dns = await import('node:dns');
    dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(value => value.trim()).filter(Boolean));
  }
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'quizDB');
    await db.command({ ping: 1 }, { timeoutMS: 5000 });
    const rows = await db.collection('schemaMigrations').find({ completedAt: { $exists: true } }, { projection: { _id: 1 }, timeoutMS: 5000 }).toArray();
    const applied = rows.map(row => row._id);
    return { appliedMigrations: applied, readinessMigrationApplied: applied.includes('004-readiness') };
  } finally { await client.close(); }
});
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'direct-provider-smoke-not-authenticated-app-journey', checks }, null, 2));
if (!checks.length || checks.some(check => !check.ok || check.readinessMigrationApplied === false)) process.exitCode = 1;
