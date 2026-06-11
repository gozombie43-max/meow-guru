import 'dotenv/config';
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

let client;

const getClient = () => {
  if (!endpoint) throw new Error("COSMOS_ENDPOINT env var is not configured");
  if (!key) throw new Error("COSMOS_KEY env var is not configured");

  if (!client) {
    client = new CosmosClient({ endpoint, key });
    console.log("Cosmos endpoint and key loaded");
  }

  return client;
};

export const initDB = async () => {
  const { database } = await getClient().databases.createIfNotExists({
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
  const { database } = await getClient().databases.createIfNotExists({ id: 'quizDB' });
 
  const { container } = await database.containers.createIfNotExists({
    id: 'users',
    partitionKey: { paths: ['/email'] },
  });
 
  return container;
};

// ── Notes Container ─────────────────────────────────────
export const initNotesDB = async () => {
  const { database } = await getClient().databases.createIfNotExists({ id: 'quizDB' });

  const { container } = await database.containers.createIfNotExists({
    id: 'notes',
    partitionKey: { paths: ['/id'] },
  });

  return container;
};
 
