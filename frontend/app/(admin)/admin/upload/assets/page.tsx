"use client";

import styles from "@/components/admin/AdminTool.module.css";
import dynamic from "next/dynamic";

const MassImageUpload = dynamic(() => import("@/components/admin/MassImageUpload"), { ssr: false, loading: () => <p style={{ color: "#8e8e93" }}>Loading image uploader…</p> });
const MassSolutionUpload = dynamic(() => import("@/components/admin/MassSolutionUpload"), { ssr: false, loading: () => <p style={{ color: "#8e8e93" }}>Loading solution uploader…</p> });

export default function AssetUploadPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>ZIP Asset Pipeline</h1>
          <p className={styles.pageSubtitle}>Batch ingest question diagrams and solution illustrations packed into ZIP archives with automatic database patching.</p>
        </div>
      </header>
      
      <div style={{ display: "grid", gap: 16 }}>
        <MassImageUpload subjectId="" topicId="" quizId="" subjectName="" topicName="" quizName="" />
        <MassSolutionUpload />
      </div>
    </div>
  );
}
