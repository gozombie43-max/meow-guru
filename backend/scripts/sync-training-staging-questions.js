import { MongoClient } from 'mongodb';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
};

const optional = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
};

const mongoSrvHost = (uri, label) => {
  if (!uri.startsWith('mongodb+srv://')) throw new Error(`${label} must use mongodb+srv://`);
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, 'https://')).hostname.toLowerCase();
  } catch {
    throw new Error(`${label} is not a valid MongoDB SRV URI`);
  }
};

const sourceUri = optional('SOURCE_MONGODB_URI', 'MONGODB_URI');
if (!sourceUri) throw new Error('Set SOURCE_MONGODB_URI (or legacy MONGODB_URI)');
const targetUri = required('STAGING_MONGODB_URI');
const sourceDbName = optional('SOURCE_MONGODB_DB', 'MONGODB_DB') || 'quizDB';
const targetDbName = process.env.STAGING_MONGODB_DB?.trim() || 'quizDB_staging';
const expectedTargetHost = required('STAGING_MONGODB_EXPECTED_HOST').toLowerCase();

if (/staging/i.test(sourceDbName)) throw new Error('Production source database name must not identify staging');
if (!/staging/i.test(targetDbName)) throw new Error('STAGING_MONGODB_DB must clearly identify staging');
if (sourceUri === targetUri) throw new Error('Production and staging MongoDB URIs must differ');

const sourceHost = mongoSrvHost(sourceUri, 'Production source URI');
const targetHost = mongoSrvHost(targetUri, 'STAGING_MONGODB_URI');
if (targetHost !== expectedTargetHost)
  throw new Error('STAGING_MONGODB_URI does not match STAGING_MONGODB_EXPECTED_HOST');
if (sourceHost === targetHost)
  throw new Error('Production source and staging target must use different MongoDB clusters');

const source = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
const target = new MongoClient(targetUri, { serverSelectionTimeoutMS: 10000 });

try {
  await Promise.all([source.connect(), target.connect()]);
  const sourceQuestions = source.db(sourceDbName).collection('questions');
  const targetQuestions = target.db(targetDbName).collection('questions');
  const sourceCount = await sourceQuestions.countDocuments({});
  if (sourceCount < 100) throw new Error(`Refusing staging sync: source question count is only ${sourceCount}`);

  await targetQuestions.deleteMany({});
  const cursor = sourceQuestions.find({});
  let batch = [];
  let copied = 0;
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= 500) {
      await targetQuestions.insertMany(batch, { ordered: false });
      copied += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await targetQuestions.insertMany(batch, { ordered: false });
    copied += batch.length;
  }

  const targetCount = await targetQuestions.countDocuments({});
  if (targetCount !== sourceCount || copied !== sourceCount)
    throw new Error(`Question sync mismatch: source=${sourceCount} copied=${copied} target=${targetCount}`);

  console.log(JSON.stringify({ sourceDbName, targetDbName, sourceCount, targetCount }));
} finally {
  await Promise.allSettled([source.close(), target.close()]);
}
