// backend/scripts/seedAccessCode.js
// Run once: node scripts/seedAccessCode.js
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

if (!endpoint || !key) {
  console.error('❌ COSMOS_ENDPOINT and COSMOS_KEY must be set in .env');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });

async function seed() {
  const { database } = await client.databases.createIfNotExists({ id: 'quizDB' });
  const { container } = await database.containers.createIfNotExists({
    id: 'accessCodes',
    partitionKey: { paths: ['/code'] },
  });

  const codeDoc = {
    id: 'code_8481',
    code: '8481',
    active: true,
    expiresAt: '2027-01-01T00:00:00Z',
    maxUses: 9999,
    usedCount: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await container.items.upsert(codeDoc);
    console.log('✅ Access code "8481" seeded successfully!');
    console.log(JSON.stringify(codeDoc, null, 2));
  } catch (err) {
    console.error('❌ Failed to seed access code:', err.message);
    process.exit(1);
  }
}

seed();
