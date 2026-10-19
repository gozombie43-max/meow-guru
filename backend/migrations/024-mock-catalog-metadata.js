import { initializeMockCatalogMetadata } from '../repositories/mockCatalogMetadataRepository.js';
export const id = '024-mock-catalog-metadata';
export async function up(db) {
  if (await db.collection('schemaMigrations').findOne({ _id: id, completedAt: { $exists: true } })) return;
  await initializeMockCatalogMetadata(db);
}
