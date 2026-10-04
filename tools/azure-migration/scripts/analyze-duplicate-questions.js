import dotenv from "dotenv";
import { CosmosClient } from "@azure/cosmos";
import crypto from "crypto";

dotenv.config();

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const container = client
  .database(process.env.COSMOS_DATABASE)
  .container(process.env.COSMOS_CONTAINER);

function removeCosmosFields(item) {
  const {
    _rid,
    _self,
    _etag,
    _attachments,
    _ts,
    ...clean
  } = item;

  return clean;
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(obj).sort();

  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify(obj[key])}`
    )
    .join(",")}}`;
}

function signature(item) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(removeCosmosFields(item)))
    .digest("hex");
}

async function analyze() {
  try {
    // Show the real Cosmos partition key
    const { resource } = await container.read();

    console.log("================================");
    console.log(
      "Cosmos partition key:",
      resource?.partitionKey?.paths
    );
    console.log("================================");

    const map = new Map();

    const iterator = container.items.query(
      "SELECT * FROM c",
      {
        maxItemCount: 500,
      }
    );

    let total = 0;

    while (iterator.hasMoreResults()) {
      const { resources = [] } =
        await iterator.fetchNext();

      for (const item of resources) {
        total++;

        if (!map.has(item.id)) {
          map.set(item.id, []);
        }

        map.get(item.id).push(item);
      }
    }

    const duplicateGroups = [...map.entries()].filter(
      ([, items]) => items.length > 1
    );

    let exactDuplicateGroups = 0;
    let conflictingGroups = 0;

    const conflicts = [];

    for (const [id, items] of duplicateGroups) {
      const signatures = new Set(
        items.map(signature)
      );

      if (signatures.size === 1) {
        exactDuplicateGroups++;
      } else {
        conflictingGroups++;

        conflicts.push({
          id,
          items,
        });
      }
    }

    console.log("");
    console.log("Total documents:", total);
    console.log(
      "Duplicate ID groups:",
      duplicateGroups.length
    );
    console.log(
      "Exact duplicate groups:",
      exactDuplicateGroups
    );
    console.log(
      "Different-question duplicate groups:",
      conflictingGroups
    );

    console.log("");
    console.log("===== SAMPLE CONFLICTS =====");

    for (const group of conflicts.slice(0, 10)) {
      console.log(`\nID: ${group.id}`);

      group.items.forEach((item, index) => {
        console.log(`  Document ${index + 1}:`);

        console.log({
          id: item.id,
          gid: item.gid,
          category: item.category,
          topic: item.topic,
          exam: item.exam,
          year: item.year,
          question:
            typeof item.question === "string"
              ? item.question.slice(0, 120)
              : item.question,
          answer: item.answer,
        });
      });
    }
  } catch (error) {
    console.error("❌ Analysis failed");
    console.error(error);
  }
}

analyze();