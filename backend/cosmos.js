import 'dotenv/config';
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

if (!endpoint) throw new Error("Cosmos ENV not loaded ❌");
if (!key) throw new Error("Cosmos KEY not loaded ❌");

console.log("Endpoint and Key loaded ✅");

const client = new CosmosClient({ endpoint, key });

export const initDB = async () => {
  const { database } = await client.databases.createIfNotExists({
    id: "quizDB",
  });

  const { container } = await database.containers.createIfNotExists({
    id: "questions",
    partitionKey: {
      paths: ["/topic"],
    },
  });

  return container;
};

// ── Users Container ─────────────────────────────────────
export const initUsersDB = async () => {
  const { database } = await client.databases.createIfNotExists({ id: 'quizDB' });
 
  const { container } = await database.containers.createIfNotExists({
    id: 'users',
    partitionKey: { paths: ['/email'] },
  });
 
  return container;
};
 