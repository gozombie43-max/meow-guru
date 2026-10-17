import styles from './MockTestLoading.module.css';

export default function MockTestLoading() {
  return (
    <div className={styles.screen}>
      <div className={styles.status} role="status" aria-live="polite">
        <svg className={styles.spinner} viewBox="0 0 32 32" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <line key={index} x1="16" y1="3" x2="16" y2="9"
              transform={`rotate(${index * 30} 16 16)`}
              style={{ animationDelay: `${index / 12 - 1}s` }} />
          ))}
        </svg>
        <p>Loading Mock Test</p>
      </div>
    </div>
  );
}
