"use client";

import styles from "@/components/admin/AdminTool.module.css";
import dynamic from "next/dynamic";
import { useExamMode } from "@/context/ExamModeContext";

const QuestionBankZipUpload = dynamic(
  () => import("@/features/admin/questions/QuestionBankZipUpload"),
  { ssr: false, loading: () => <p style={{ color: "#8e8e93" }}>Loading Question Bank ZIP uploader…</p> }
);

export default function AssetUploadPage() {
  const { mode: examMode } = useExamMode();

  return (
    <div className={styles.shell}>
      <header data-ui-chrome="header" className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>ZIP Asset Pipeline</h1>
          <p className={styles.pageSubtitle}>Batch ingest question diagrams, solution illustrations, and option images packed into ZIP archives with automatic database patching.</p>
        </div>
      </header>
      
      <div style={{ display: "grid", gap: 16 }}>
        <QuestionBankZipUpload examMode={examMode} />
      </div>
    </div>
  );
}
