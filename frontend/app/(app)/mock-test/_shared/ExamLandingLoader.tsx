import styles from './ExamLandingPage.module.css';

export default function ExamLandingLoader() {
  return <div className={`${styles.placeholderTab} ${styles.inlineLoader}`} role="status" aria-label="Loading tests" aria-busy="true">
    <div className={styles.loadingIndicator}>
      <span className={styles.loadingSpinner} aria-hidden="true" />
      <span>Loading tests…</span>
    </div>
  </div>;
}
