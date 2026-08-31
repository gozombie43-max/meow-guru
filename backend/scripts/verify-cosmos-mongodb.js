import dotenv from "dotenv";
import { CosmosClient } from "@azure/cosmos";
import { MongoClient } from "mongodb";
import crypto from "crypto";

dotenv.config();

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const mongoClient = new MongoClient(
  process.env.MONGODB_URI
);

function cleanObject(obj) {
  const clean = { ...obj };

  // Cosmos system fields
  delete clean._rid;
  delete clean._self;
  delete clean._etag;
  delete clean._attachments;
  delete clean._ts;

  // MongoDB system field
  delete clean._id;

  return clean;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys
    .map(
      key =>
        `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )
    .join(",")}}`;
}

function hashDocument(doc) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(cleanObject(doc)))
    .digest("hex");
}

async function verify() {
  try {
    await mongoClient.connect();

    const cosmosContainer = cosmosClient
      .database(process.env.COSMOS_DATABASE)
      .container(process.env.COSMOS_CONTAINER);

    const mongoCollection = mongoClient
      .db("quizDB")
      .collection("questions");

    console.log("Checking document counts...");

    const { resources: cosmosCountResult } =
      await cosmosContainer.items
        .query("SELECT VALUE COUNT(1) FROM c")
        .fetchAll();

    const cosmosCount = cosmosCountResult[0];
    const mongoCount =
      await mongoCollection.countDocuments();

    console.log("Cosmos count :", cosmosCount);
    console.log("Mongo count  :", mongoCount);

    if (cosmosCount !== mongoCount) {
      console.error("❌ Counts do not match");
      return;
    }

    console.log("✅ Counts match");
    console.log("");
    console.log("Checking every question...");

    const iterator =
      cosmosContainer.items.query(
        "SELECT * FROM c",
        { maxItemCount: 500 }
      );

    let checked = 0;
    let missing = 0;
    let mismatched = 0;

    while (iterator.hasMoreResults()) {
      const { resources = [] } =
        await iterator.fetchNext();

      for (const cosmosQuestion of resources) {
        const mongoQuestion =
          await mongoCollection.findOne({
            id: cosmosQuestion.id,
            topic: cosmosQuestion.topic,
          });

        if (!mongoQuestion) {
          missing++;

          console.error(
            "❌ Missing:",
            cosmosQuestion.id,
            cosmosQuestion.topic
          );

          continue;
        }

        const cosmosHash =
          hashDocument(cosmosQuestion);

        const mongoHash =
          hashDocument(mongoQuestion);

        if (cosmosHash !== mongoHash) {
          mismatched++;

          console.error(
            "⚠️ Data mismatch:",
            cosmosQuestion.id,
            cosmosQuestion.topic
          );
        }

        checked++;

        if (checked % 1000 === 0) {
          console.log(`Verified: ${checked}`);
        }
      }
    }

    console.log("");
    console.log("==============================");
    console.log("VERIFICATION RESULTS");
    console.log("==============================");
    console.log("Checked    :", checked);
    console.log("Missing    :", missing);
    console.log("Mismatched :", mismatched);

    if (
      checked === cosmosCount &&
      missing === 0 &&
      mismatched === 0
    ) {
      console.log("");
      console.log("✅ FULL DATA INTEGRITY VERIFIED");
    } else {
      console.log("");
      console.log(
        "❌ Verification found problems"
      );
    }
  } catch (error) {
    console.error("❌ Verification failed");
    console.error(error);
  } finally {
    await mongoClient.close();
  }
}

verify();
