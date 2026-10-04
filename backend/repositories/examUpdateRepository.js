import { getExamUpdatesCollection } from '../config/mongodb.js';
import { readKeysetPage } from '../infrastructure/keysetPage.js';
export const readExamUpdateCursor = options => readKeysetPage(getExamUpdatesCollection(), options);
export async function readExamUpdatePage(filter, page, limit) {
  const collection = getExamUpdatesCollection();
  const [items, total] = await Promise.all([
    collection.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);
  return [items, total];
}
