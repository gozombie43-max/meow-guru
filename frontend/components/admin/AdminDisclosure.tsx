import type { ReactNode } from "react";
import styles from "./AdminLayout.module.css";

export default function AdminDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.disclosure}>
      <summary>{title}</summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}
