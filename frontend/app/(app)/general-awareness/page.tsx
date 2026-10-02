import GeneralAwarenessHubClient from "./GeneralAwarenessHubClient";
import { CatalogSeed } from '@/components/subject-hub/CatalogSeed';
import { getPublicTopicCounts } from '@/lib/server/publicCatalog';

export default async function GeneralAwarenessPage() {
  const snapshot = await getPublicTopicCounts('general-awareness');
  return <CatalogSeed snapshot={snapshot}><GeneralAwarenessHubClient /></CatalogSeed>;
}
