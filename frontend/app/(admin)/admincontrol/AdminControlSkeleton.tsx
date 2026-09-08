import styles from "./AdminControlPage.module.css";

export default function AdminControlSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading admin control">
      <div aria-hidden="true">
        <span className={`${styles.skeleton} ${styles.skeletonHeading}`} />
        <div className={styles.skeletonCards}>
          {[1, 2, 3, 4].map((key) => <span key={key} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
        </div>
      </div>
    </div>
  );
}
