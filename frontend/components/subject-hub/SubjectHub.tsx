"use client";
import type { SubjectHubConfig } from './types';
import { useSubjectHubView } from './useSubjectHubView';
import { SubjectHubMobile } from './SubjectHubMobile';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ListingTemplate } from '@/design-system';
import dynamic from 'next/dynamic';

const SubjectHubDesktop = dynamic(() => import('./SubjectHubDesktop').then(module => module.SubjectHubDesktop), { ssr: false });

export default function SubjectHub({ config }: { config: SubjectHubConfig }) {
  // This hook starts false on both the server and the hydration pass.
  // Phones retain their server-rendered mobile view without mounting desktop UI.
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const view = useSubjectHubView({ config, enableDesktop: isDesktop });
  const { styles } = view;

  return (
    <ListingTemplate
      columns={1}
      wide
      maxWidth="100%"
      header={null}
      hasStickyHeader={false}
      showNavRail={false}
      showBottomNav={false}
      mainClassName={styles.listingMain}
    >
      <div className={styles.pageRoot} data-subject={config.subjectId} data-topic-layout="compact">
        {isDesktop ? <SubjectHubDesktop view={view} /> : <SubjectHubMobile view={view} />}
      </div>
    </ListingTemplate>
  );
}
