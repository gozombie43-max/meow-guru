import dotenv from "dotenv";
import { CosmosClient } from "@azure/cosmos";

dotenv.config();

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const container = client
  .database(process.env.COSMOS_DATABASE)
  .container(process.env.COSMOS_CONTAINER);

async function checkDuplicates() {
  const counts = new Map();
  const examples = new Map();

  let total = 0;

  const iterator = container.items.query(
    "SELECT c.id, c.category, c.topic, c.exam FROM c",
    { maxItemCount: 500 }
  );

  while (iterator.hasMoreResults()) {
    const { resources = [] } = await iterator.fetchNext();

    for (const item of resources) {
      total++;

      const id = item.id;

      counts.set(id, (counts.get(id) || 0) + 1);

      if (!examples.has(id)) {
        examples.set(id, []);
      }

      examples.get(id).push({
        category: item.category,
        topic: item.topic,
        exam: item.exam,
      });
    }
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  const uniqueIds = counts.size;

  console.log("================================");
  console.log("Total Cosmos documents:", total);
  console.log("Unique IDs:", uniqueIds);
  console.log("Duplicate ID groups:", duplicates.length);
  console.log("Extra duplicate documents:", total - uniqueIds);
  console.log("================================");

  for (const [id, count] of duplicates.slice(0, 20)) {
    console.log(`\nID: ${id} (${count} documents)`);
    console.log(examples.get(id));
  }
}

checkDuplicates().catch(console.error);