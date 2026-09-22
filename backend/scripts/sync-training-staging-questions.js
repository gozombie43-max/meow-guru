import { MongoClient } from 'mongodb';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
};

const sourceUri = required('MONGODB_URI');
const targetUri = required('STAGING_MONGODB_URI');
const sourceDbName = process.env.MONGODB_DB?.trim() || 'quizDB';
const targetDbName = process.env.STAGING_MONGODB_DB?.trim() || 'quizDB_staging';
const expectedTargetHost = required('STAGING_MONGODB_EXPECTED_HOST').toLowerCase();

if (!/staging/i.test(targetDbName)) throw new Error('STAGING_MONGODB_DB must clearly identify staging');
if (sourceUri === targetUri) throw new Error('Production and staging MongoDB URIs must differ');

const targetUrl = new URL(targetUri.replace('mongodb+srv://', 'https://'));
if (targetUrl.hostname.toLowerCase() !== expectedTargetHost)
  throw new Error('STAGING_MONGODB_URI does not match STAGING_MONGODB_EXPECTED_HOST');

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
