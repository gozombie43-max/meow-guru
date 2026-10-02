import EnglishHubClient from "./EnglishHubClient";
import { CatalogSeed } from '@/components/subject-hub/CatalogSeed';
import { getPublicTopicCounts } from '@/lib/server/publicCatalog';

export default async function EnglishPage() {
  const snapshot = await getPublicTopicCounts('english');
  return <CatalogSeed snapshot={snapshot}><EnglishHubClient /></CatalogSeed>;
}
