import 'dotenv/config';

import crypto from 'crypto';
import { MongoClient } from 'mongodb';

import {
  initUsersDB,
  initAccessCodesDB,
} from '../cosmos.js';

const mongoClient = new MongoClient(
  process.env.MONGODB_URI
);

function cleanCosmos(doc) {
  const {
    _rid,
    _self,
    _etag,
    _attachments,
    _ts,
    ...rest
  } = doc;

  return rest;
}

function cleanMongo(doc) {
  const {
    _id,
    _cosmosRid,
    ...rest
  } = doc;

  return rest;
}

function stable(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(
      key =>
        `${JSON.stringify(key)}:${stable(value[key])}`
    )
    .join(',')}}`;
}

function hash(doc) {
  return crypto
    .createHash('sha256')
    .update(stable(doc))
    .digest('hex');
}

async function verifyCollection(
  cosmosContainer,
  mongoCollection,
  label
) {
  const { resources: cosmosDocs } =
    await cosmosContainer.items
      .query('SELECT * FROM c')
      .fetchAll();

  const mongoDocs =
    await mongoCollection.find({}).toArray();

  let missing = 0;
  let mismatched = 0;

  for (const cosmosDoc of cosmosDocs) {
    const mongoDoc =
      await mongoCollection.findOne({
        _cosmosRid: cosmosDoc._rid,
      });

    if (!mongoDoc) {
      missing++;
      console.log(
        `❌ Missing ${label}:`,
        cosmosDoc.id
      );
      continue;
    }

    if (
      hash(cleanCosmos(cosmosDoc)) !==
      hash(cleanMongo(mongoDoc))
    ) {
      mismatched++;

      console.log(
        `⚠️ Mismatch ${label}:`,
        cosmosDoc.id
      );
    }
  }

  console.log('');
  console.log(`${label}`);
  console.log(
    `Cosmos      : ${cosmosDocs.length}`
  );
  console.log(
    `MongoDB     : ${mongoDocs.length}`
  );
  console.log(
    `Missing     : ${missing}`
  );
  console.log(
    `Mismatched  : ${mismatched}`
  );

  return (
    cosmosDocs.length === mongoDocs.length &&
    missing === 0 &&
    mismatched === 0
  );
}

async function run() {
  try {
    await mongoClient.connect();

    const db =
      mongoClient.db('quizDB');

    const usersCosmos =
      await initUsersDB();

    const accessCodesCosmos =
      await initAccessCodesDB();

    console.log(
      '=============================='
    );
    console.log(
      'VERIFYING REMAINING DATA'
    );
    console.log(
      '=============================='
    );

    const usersOk =
      await verifyCollection(
        usersCosmos,
        db.collection('users'),
        'Users'
      );

    const codesOk =
      await verifyCollection(
        accessCodesCosmos,
        db.collection('accessCodes'),
        'Access Codes'
      );

    console.log('');
    console.log(
      '=============================='
    );

    if (usersOk && codesOk) {
      console.log(
        '✅ FULL DATA INTEGRITY VERIFIED'
      );
    } else {
      console.log(
        '❌ Verification found problems'
      );
    }

    console.log(
      '=============================='
    );

  } catch (error) {
    console.error(
      '❌ Verification failed',
      error
    );
  } finally {
    await mongoClient.close();
  }
}

run();