import MathematicsHubClient from "./MathematicsHubClient";
import { CatalogSeed } from '@/components/subject-hub/CatalogSeed';
import { getPublicTopicCounts } from '@/lib/server/publicCatalog';

export default async function MathematicsPage() {
  const snapshot = await getPublicTopicCounts('mathematics');
  return <CatalogSeed snapshot={snapshot}><MathematicsHubClient /></CatalogSeed>;
}
