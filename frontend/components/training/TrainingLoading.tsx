import { LoaderCircle } from "lucide-react";
import "./training-loading.css";

export function TrainingLoading({
  title = "Loading your questions",
  description = "Getting your saved progress and question set ready.",
  skeleton = true,
}: {
  title?: string;
  description?: string;
  skeleton?: boolean;
}) {
  return (
    <div className="training-loading-state">
      <div className="training-loading-message" role="status" aria-live="polite" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <LoaderCircle className="training-loading-icon" size={48} aria-hidden="true" style={{ margin: '0 auto 16px' }} />
        <div><h1 style={{ fontSize: '32px', color: '#64748b', margin: '0 0 12px 0' }}>{title}</h1><p style={{ fontSize: '18px', color: '#94a3b8', margin: 0, maxWidth: 500 }}>{description}</p></div>
      </div>
      {skeleton && (
        <div className="training-loading-skeleton" aria-hidden="true">
          <div className="training-skeleton-line is-short" />
          <div className="training-skeleton-line" />
          <div className="training-skeleton-line is-medium" />
          <div className="training-skeleton-options">
            {[0, 1, 2, 3].map(index => (
              <div className="training-skeleton-option" key={index}>
                <span className="training-skeleton-circle" />
                <span className="training-skeleton-line" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
