import dotenv from "dotenv";
import { CosmosClient } from "@azure/cosmos";
import { MongoClient } from "mongodb";

dotenv.config();

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const mongoClient = new MongoClient(process.env.MONGODB_URI);

function cleanCosmos(doc) {
  const {
    _rid,
    _self,
    _etag,
    _attachments,
    _ts,
    ...clean
  } = doc;

  return clean;
}

function cleanMongo(doc) {
  const {
    _id,
    ...clean
  } = doc;

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

function preview(value) {
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value);

  if (text === undefined) return "undefined";

  return text.length > 300
    ? text.slice(0, 300) + "..."
    : text;
}

function findDifferences(a, b, path = "") {
  const differences = [];

  const keys = new Set([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
  ]);

  for (const key of keys) {
    const currentPath = path
      ? `${path}.${key}`
      : key;

    const left = a?.[key];
    const right = b?.[key];

    if (
      left &&
      right &&
      typeof left === "object" &&
      typeof right === "object" &&
      !Array.isArray(left) &&
      !Array.isArray(right)
    ) {
      differences.push(
        ...findDifferences(left, right, currentPath)
      );
      continue;
    }

    if (stableStringify(left) !== stableStringify(right)) {
      differences.push({
        field: currentPath,
        cosmos: left,
        mongodb: right,
      });
    }
  }

  return differences;
}

async function run() {
  try {
    await mongoClient.connect();

    const cosmosContainer = cosmosClient
      .database(process.env.COSMOS_DATABASE)
      .container(process.env.COSMOS_CONTAINER);

    const mongoCollection = mongoClient
      .db("quizDB")
      .collection("questions");

    const iterator = cosmosContainer.items.query(
      "SELECT * FROM c",
      { maxItemCount: 500 }
    );

    let checked = 0;

    while (iterator.hasMoreResults()) {
      const { resources = [] } =
        await iterator.fetchNext();

      for (const cosmosDoc of resources) {
        const mongoDoc =
          await mongoCollection.findOne({
            id: cosmosDoc.id,
            topic: cosmosDoc.topic,
          });

        checked++;

        if (!mongoDoc) continue;

        const cosmosClean =
          cleanCosmos(cosmosDoc);

        const mongoClean =
          cleanMongo(mongoDoc);

        if (
          stableStringify(cosmosClean) !==
          stableStringify(mongoClean)
        ) {
          console.log(
            "================================"
          );
          console.log("❌ MISMATCH FOUND");
          console.log("ID:", cosmosDoc.id);
          console.log("Topic:", cosmosDoc.topic);
          console.log("Exam:", cosmosDoc.exam);
          console.log(
            "================================"
          );

          const differences =
            findDifferences(
              cosmosClean,
              mongoClean
            );

          console.log(
            "Different fields:",
            differences.length
          );

          for (const diff of differences) {
            console.log("");
            console.log("Field:", diff.field);
            console.log(
              "Cosmos :",
              preview(diff.cosmos)
            );
            console.log(
              "MongoDB:",
              preview(diff.mongodb)
            );
          }

          return;
        }
      }
    }

    console.log(
      `✅ No mismatch found after checking ${checked}`
    );
  } catch (error) {
    console.error("❌ Check failed");
    console.error(error);
  } finally {
    await mongoClient.close();
  }
}

run();