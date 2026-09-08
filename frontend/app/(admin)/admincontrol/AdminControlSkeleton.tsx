import styles from "./AdminControlPage.module.css";

export default function AdminControlSkeleton() {
  return (
    <div
      className={styles.page}
      aria-busy="true"
      aria-label="Loading admin control"
    >
      <div className={`${styles.window} ${styles.loadingWindow}`}>
        <aside className={styles.sidebar} aria-hidden="true">
          <span className={`${styles.skeleton} ${styles.skeletonBrand}`} />
          <span
            className={`${styles.skeleton} ${styles.skeletonSidebarLabel}`}
          />
          <span
            className={`${styles.skeleton} ${styles.skeletonSidebarItem}`}
          />
          <span
            className={`${styles.skeleton} ${styles.skeletonSidebarItem}`}
          />
          <span className={`${styles.skeleton} ${styles.skeletonProfile}`} />
        </aside>
        <div className={styles.workspace}>
          <header className={styles.toolbar} aria-hidden="true">
            <span className={`${styles.skeleton} ${styles.skeletonBack}`} />
            <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          </header>
          <main className={styles.content} aria-hidden="true">
            <div className={styles.skeletonDesktopHeading}>
              <span
                className={`${styles.skeleton} ${styles.skeletonEyebrow}`}
              />
              <span
                className={`${styles.skeleton} ${styles.skeletonHeading}`}
              />
              <span
                className={`${styles.skeleton} ${styles.skeletonSubtitle}`}
              />
            </div>
            <div className={styles.skeletonMobileFilters}>
              <span className={`${styles.skeleton} ${styles.skeletonFilter}`} />
              <span className={`${styles.skeleton} ${styles.skeletonFilter}`} />
            </div>
            <div className={styles.skeletonSection}>
              <span
                className={`${styles.skeleton} ${styles.skeletonSectionTitle}`}
              />
              <div className={styles.skeletonCards}>
                {["one", "two", "three", "four"].map((card) => (
                  <span
                    className={`${styles.skeleton} ${styles.skeletonCard}`}
                    key={card}
                  />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
