"use client";
import type { SubjectHubConfig } from './types';
import { useSubjectHubView } from './useSubjectHubView';
import { SubjectHubMobile } from './SubjectHubMobile';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import dynamic from 'next/dynamic';

const SubjectHubDesktop = dynamic(() => import('./SubjectHubDesktop').then(module => module.SubjectHubDesktop), { ssr: false });

export default function SubjectHub({ config }: { config: SubjectHubConfig }) {
 // This hook starts false on both the server and the hydration pass.
 // Phones retain their server-rendered mobile view without mounting desktop UI.
 const isDesktop = useMediaQuery('(min-width: 768px)');
 const view = useSubjectHubView({ config, enableDesktop: isDesktop });
 const { styles, oledMobile } = view;
 return (
    <div className={styles.pageRoot} data-subject={config.subjectId} data-topic-layout={oledMobile ? "compact" : undefined}>
      {isDesktop ? <SubjectHubDesktop view={view} /> : <SubjectHubMobile view={view} />}
    </div>
  );
}
