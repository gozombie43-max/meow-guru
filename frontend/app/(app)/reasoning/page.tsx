import ReasoningHubClient from "./ReasoningHubClient";
import { CatalogSeed } from '@/components/subject-hub/CatalogSeed';
import { getPublicTopicCounts } from '@/lib/server/publicCatalog';

export default async function ReasoningPage() {
  const snapshot = await getPublicTopicCounts('reasoning');
  return <CatalogSeed snapshot={snapshot}><ReasoningHubClient /></CatalogSeed>;
}
