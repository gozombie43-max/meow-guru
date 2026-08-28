import 'dotenv/config';
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

let client;

// ── In-Memory Mock Container for Test / Offline Environments ───────────
function createMockContainer(name, partitionKeyPath = '/id') {
  const store = new Map();

  return {
    _name: name,
    _store: store,
    items: {
      create: async (item) => {
        const id = item.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const record = { ...item, id };
        store.set(id, record);
        return { resource: record };
      },
      upsert: async (item) => {
        const id = item.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const record = { ...item, id };
        store.set(id, record);
        return { resource: record };
      },
      query: (querySpec) => {
        return {
          fetchAll: async () => {
            const allItems = Array.from(store.values());
            if (!querySpec || !querySpec.parameters) {
              return { resources: allItems };
            }
            // Basic filtering if parameter values match item properties
            let filtered = allItems;
            for (const param of querySpec.parameters || []) {
              const val = param.value;
              if (val !== undefined && val !== null) {
                filtered = filtered.filter((item) => {
                  return Object.values(item).some((v) => String(v).toLowerCase() === String(val).toLowerCase());
                });
              }
            }
            return { resources: filtered.length > 0 ? filtered : allItems };
          },
        };
      },
    },
    item: (id, partitionKey) => ({
      read: async () => {
        const item = store.get(id);
        return { resource: item || null };
      },
      replace: async (newItem) => {
        store.set(id, { ...newItem, id });
        return { resource: store.get(id) };
      },
      delete: async () => {
        store.delete(id);
        return { resource: null };
      },
    }),
  };
}

const getClient = () => {
  if (!endpoint || !key) {
    return null;
  }

  if (!client) {
    client = new CosmosClient({ endpoint, key });
    console.log("Cosmos endpoint and key loaded ✅");
  }

  return client;
};

export const initDB = async () => {
  const c = getClient();
  if (!c) {
    console.warn("⚠️ COSMOS credentials not found. Using in-memory store for questions DB.");
    return createMockContainer("questions", "/topic");
  }
  const { database } = await c.databases.createIfNotExists({ id: "quizDB" });
  const { container } = await database.containers.createIfNotExists({
    id: "questions",
    partitionKey: { paths: ["/topic"] },
  });
  return container;
};

// ── Users Container ─────────────────────────────────────
export const initUsersDB = async () => {
  const c = getClient();
  if (!c) {
    console.warn("⚠️ COSMOS credentials not found. Using in-memory store for users DB.");
    return createMockContainer("users", "/email");
  }
  const { database } = await c.databases.createIfNotExists({ id: 'quizDB' });
  const { container } = await database.containers.createIfNotExists({
    id: 'users',
    partitionKey: { paths: ['/email'] },
  });
  return container;
};

// ── Access Codes Container ──────────────────────────────
export const initAccessCodesDB = async () => {
  const c = getClient();
  if (!c) {
    console.warn("⚠️ COSMOS credentials not found. Using in-memory store for accessCodes DB.");
    return createMockContainer("accessCodes", "/code");
  }
  const { database } = await c.databases.createIfNotExists({ id: 'quizDB' });
  const { container } = await database.containers.createIfNotExists({
    id: 'accessCodes',
    partitionKey: { paths: ['/code'] },
  });
  return container;
};

// ── Notes Container ─────────────────────────────────────
export const initNotesDB = async () => {
  const c = getClient();
  if (!c) {
    console.warn("⚠️ COSMOS credentials not found. Using in-memory store for notes DB.");
    return createMockContainer("notes", "/id");
  }
  const { database } = await c.databases.createIfNotExists({ id: 'quizDB' });
  const { container } = await database.containers.createIfNotExists({
    id: 'notes',
    partitionKey: { paths: ['/id'] },
  });
  return container;
};

// ── Mock Attempts Container ──────────────────────────────
export const initMockAttemptsDB = async () => {
  const c = getClient();
  if (!c) {
    console.warn("⚠️ COSMOS credentials not found. Using in-memory store for mockAttempts DB.");
    return createMockContainer("mockAttempts", "/userId");
  }
  const { database } = await c.databases.createIfNotExists({ id: 'quizDB' });
  const { container } = await database.containers.createIfNotExists({
    id: 'mockAttempts',
    partitionKey: { paths: ['/userId'] },
  });
  return container;
};

// ── Mock Test Slots Container ────────────────────────────
export const initMockSlotsDB = async () => {
  const c = getClient();
  if (!c) {
    console.warn("⚠️ COSMOS credentials not found. Using in-memory store for mockTestSlots DB.");
    return createMockContainer("mockTestSlots", "/examSlug");
  }
  const { database } = await c.databases.createIfNotExists({ id: 'quizDB' });
  const { container } = await database.containers.createIfNotExists({
    id: 'mockTestSlots',
    partitionKey: { paths: ['/examSlug'] },
  });
  return container;
};

