import dotenv from "dotenv";
import { CosmosClient } from "@azure/cosmos";
import { MongoClient } from "mongodb";

dotenv.config();

const {
  COSMOS_ENDPOINT,
  COSMOS_KEY,
  COSMOS_DATABASE = "quizDB",
  COSMOS_CONTAINER = "questions",
  MONGODB_URI,
} = process.env;

if (!COSMOS_ENDPOINT || !COSMOS_KEY || !MONGODB_URI) {
  throw new Error(
    "Missing COSMOS_ENDPOINT, COSMOS_KEY, or MONGODB_URI in .env"
  );
}

const cosmosClient = new CosmosClient({
  endpoint: COSMOS_ENDPOINT,
  key: COSMOS_KEY,
});

const mongoClient = new MongoClient(MONGODB_URI);

async function migrate() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoClient.connect();

    const mongoDb = mongoClient.db("quizDB");
    const mongoCollection = mongoDb.collection("questions");

    console.log("✅ MongoDB connected");

    const cosmosContainer = cosmosClient
      .database(COSMOS_DATABASE)
      .container(COSMOS_CONTAINER);

    console.log("✅ Cosmos DB configured");

    // Preserve identical question IDs when they belong to different topics.
    await mongoCollection.createIndex(
      { id: 1, topic: 1 },
      { unique: true }
    );

    const iterator = cosmosContainer.items.query(
      "SELECT * FROM c",
      {
        maxItemCount: 500,
      }
    );

    let migrated = 0;
    let skipped = 0;

    console.log("Starting migration...");

    while (iterator.hasMoreResults()) {
      const { resources = [] } = await iterator.fetchNext();

      const operations = [];

      for (const item of resources) {
        const {
          _rid,
          _self,
          _etag,
          _attachments,
          _ts,
          ...question
        } = item;

        if (!question.id) {
          skipped++;
          continue;
        }

        operations.push({
          updateOne: {
            filter: {
              id: question.id,
              topic: question.topic,
            },
            update: {
              $set: question,
            },
            upsert: true,
          },
        });
      }

      if (operations.length > 0) {
        await mongoCollection.bulkWrite(operations, {
          ordered: false,
        });

        migrated += operations.length;

        console.log(`Migrated: ${migrated}`);
      }
    }

    const finalCount =
      await mongoCollection.countDocuments();

    console.log("");
    console.log("==============================");
    console.log("✅ MIGRATION COMPLETE");
    console.log(`Processed: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`MongoDB documents: ${finalCount}`);
    console.log("==============================");
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
  } finally {
    await mongoClient.close();
  }
}

migrate();
