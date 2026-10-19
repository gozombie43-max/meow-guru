import styles from './MockTestLoading.module.css';

export default function MockTestLoading({ label = 'Loading test…' }: { label?: string }) {
  return (
    <div className={styles.screen} aria-busy="true">
      <div className={styles.status} role="status" aria-live="polite">
        <svg className={styles.spinner} viewBox="0 0 32 32" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <line key={index} x1="16" y1="3" x2="16" y2="9"
              transform={`rotate(${index * 30} 16 16)`}
              style={{ animationDelay: `${index / 12 - 1}s` }} />
          ))}
        </svg>
        <p>{label}</p>
      </div>
    </div>
  );
}
