import dotenv from "dotenv";
import { CosmosClient } from "@azure/cosmos";

dotenv.config();

const {
  COSMOS_ENDPOINT,
  COSMOS_KEY,
  COSMOS_DATABASE,
  COSMOS_CONTAINER,
} = process.env;

if (
  !COSMOS_ENDPOINT ||
  !COSMOS_KEY ||
  !COSMOS_DATABASE ||
  !COSMOS_CONTAINER
) {
  throw new Error("Missing Cosmos environment variables");
}

const client = new CosmosClient({
  endpoint: COSMOS_ENDPOINT,
  key: COSMOS_KEY,
});

async function test() {
  try {
    const container = client
      .database(COSMOS_DATABASE)
      .container(COSMOS_CONTAINER);

    const { resources: countResult } =
      await container.items
        .query("SELECT VALUE COUNT(1) FROM c")
        .fetchAll();

    console.log("✅ Cosmos DB connected");
    console.log("Database:", COSMOS_DATABASE);
    console.log("Container:", COSMOS_CONTAINER);
    console.log("Question count:", countResult[0]);

    const { resources: samples } =
      await container.items
        .query("SELECT TOP 3 * FROM c")
        .fetchAll();

    console.log(`✅ Read ${samples.length} sample questions`);

    for (const q of samples) {
      console.log({
        id: q.id,
        topic: q.topic,
        exam: q.exam,
      });
    }
  } catch (error) {
    console.error("❌ Cosmos test failed");
    console.error(error);
  }
}

test();