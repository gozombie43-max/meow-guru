"use client";
import type { SubjectHubConfig } from './types';
import { useSubjectHubView } from './useSubjectHubView';
import { SubjectHubDesktop } from './SubjectHubDesktop';
import { SubjectHubMobile } from './SubjectHubMobile';

export default function SubjectHub({ config }: { config: SubjectHubConfig }) {
 const view = useSubjectHubView({ config });
 const { styles, oledMobile } = view;
 return (
    <div className={styles.pageRoot} data-subject={config.subjectId} data-topic-layout={oledMobile ? "compact" : undefined}>
      {/* =========================================================================
          DESKTOP PC VIEW (Zero-Scroll 100vh macOS Studio >= 768px)
          ========================================================================= */}
      <SubjectHubDesktop view={view} />

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <SubjectHubMobile view={view} />
    </div>
  );
}
