import 'dotenv/config';

import { MongoClient } from 'mongodb';

import {
  initUsersDB,
  initNotesDB,
  initAccessCodesDB,
  initMockAttemptsDB,
  initMockSlotsDB,
} from '../cosmos.js';

const mongoClient = new MongoClient(
  process.env.MONGODB_URI
);

function cleanCosmosDocument(item) {
  const {
    _rid,
    _self,
    _etag,
    _attachments,
    _ts,
    ...clean
  } = item;

  /*
   * Keep the Cosmos RID temporarily as a migration key.
   * This makes the script safe to run multiple times.
   */
  return {
    ...clean,
    _cosmosRid: _rid,
  };
}

async function migrateContainer({
  cosmosContainer,
  mongoCollection,
  label,
}) {
  console.log(`\nMigrating ${label}...`);

  const iterator = cosmosContainer.items.query(
    'SELECT * FROM c',
    {
      maxItemCount: 500,
    }
  );

  let processed = 0;

  while (iterator.hasMoreResults()) {
    const { resources = [] } =
      await iterator.fetchNext();

    for (const item of resources) {
      const document =
        cleanCosmosDocument(item);

      await mongoCollection.updateOne(
        {
          _cosmosRid: document._cosmosRid,
        },
        {
          $set: document,
        },
        {
          upsert: true,
        }
      );

      processed++;
    }
  }

  const mongoCount =
    await mongoCollection.countDocuments();

  console.log(
    `✅ ${label}: processed ${processed}, MongoDB ${mongoCount}`
  );

  return {
    processed,
    mongoCount,
  };
}

async function run() {
  try {
    await mongoClient.connect();

    console.log(
      '✅ MongoDB Atlas connected'
    );

    const db =
      mongoClient.db('quizDB');

    /*
     * Existing Cosmos containers
     */
    const usersCosmos =
      await initUsersDB();

    const notesCosmos =
      await initNotesDB();

    const accessCodesCosmos =
      await initAccessCodesDB();

    const mockAttemptsCosmos =
      await initMockAttemptsDB();

    const mockSlotsCosmos =
      await initMockSlotsDB();

    /*
     * MongoDB collections
     */
    const usersMongo =
      db.collection('users');

    const notesMongo =
      db.collection('notes');

    const accessCodesMongo =
      db.collection('accessCodes');

    const mockAttemptsMongo =
      db.collection('mockAttempts');

    const mockSlotsMongo =
      db.collection('mockSlots');

    /*
     * Unique migration key.
     * Sparse allows empty collections safely.
     */
    for (const collection of [
      usersMongo,
      notesMongo,
      accessCodesMongo,
      mockAttemptsMongo,
      mockSlotsMongo,
    ]) {
      await collection.createIndex(
        {
          _cosmosRid: 1,
        },
        {
          unique: true,
          sparse: true,
        }
      );
    }

    const results = {};

    results.users =
      await migrateContainer({
        cosmosContainer:
          usersCosmos,
        mongoCollection:
          usersMongo,
        label: 'Users',
      });

    results.notes =
      await migrateContainer({
        cosmosContainer:
          notesCosmos,
        mongoCollection:
          notesMongo,
        label: 'Notes',
      });

    results.accessCodes =
      await migrateContainer({
        cosmosContainer:
          accessCodesCosmos,
        mongoCollection:
          accessCodesMongo,
        label: 'Access Codes',
      });

    results.mockAttempts =
      await migrateContainer({
        cosmosContainer:
          mockAttemptsCosmos,
        mongoCollection:
          mockAttemptsMongo,
        label: 'Mock Attempts',
      });

    results.mockSlots =
      await migrateContainer({
        cosmosContainer:
          mockSlotsCosmos,
        mongoCollection:
          mockSlotsMongo,
        label: 'Mock Slots',
      });

    console.log('');
    console.log(
      '================================'
    );
    console.log(
      '✅ MIGRATION COMPLETE'
    );
    console.log(
      '================================'
    );

    console.log(
      `Users         : ${results.users.mongoCount}`
    );

    console.log(
      `Notes         : ${results.notes.mongoCount}`
    );

    console.log(
      `Access Codes  : ${results.accessCodes.mongoCount}`
    );

    console.log(
      `Mock Attempts : ${results.mockAttempts.mongoCount}`
    );

    console.log(
      `Mock Slots    : ${results.mockSlots.mongoCount}`
    );

    console.log(
      '================================'
    );

  } catch (error) {
    console.error(
      '❌ Migration failed'
    );

    console.error(error);
  } finally {
    await mongoClient.close();
  }
}

run();