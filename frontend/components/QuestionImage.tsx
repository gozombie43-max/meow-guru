'use client';
import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@/components/ui/Dialog';
import Image from 'next/image';
import { MoveDiagonal, X, RefreshCw } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';
import styles from './QuestionImage.module.css';

export function resolveQuestionImage(src: string) {
  if (!src.trim()) return '';
  let value = src.trim().replace(/^(https?:\/\/[^/]+\.blob\.core\.windows\.net)\/solutions\//i, '$1/questions/solutions/');
  if (value.startsWith('//')) value = `https:${value}`;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith('/api/upload/image/')) value = `/backend-api${parsed.pathname}${parsed.search}`;
    } catch {
      // Keep original value if URL constructor fails on unconventional paths
    }
  } else if (value.startsWith('/api/upload/image/')) {
    value = `/backend-api${value}`;
  } else if (!value.startsWith('data:') && !value.startsWith('blob:') && !value.startsWith(`${API_BASE}/`) && !value.startsWith('/backend-api/')) {
    if (value.startsWith('/pyq-assets/') || value.startsWith('/images/') || value.startsWith('/mock-test/') || value.startsWith('/quiz/') || value.startsWith('/monaco/') || value.startsWith('/videos/')) {
      return value;
    }
    if (value.startsWith('pyq-assets/') || value.startsWith('images/')) {
      return `/${value}`;
    }
    value = `${API_BASE}/${value.replace(/^\//, '')}`;
  }
  return value;
}

export interface QuestionImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  critical?: boolean;
  className?: string;
  enableZoom?: boolean;
  isOption?: boolean;
}

export default function QuestionImage(props: QuestionImageProps) {
  const resolved = resolveQuestionImage(props.src);
  if (!resolved) return null;
  // Remount source-specific state without a reset effect or duplicate requests.
  return <QuestionImageContent key={resolved} {...props} src={resolved} />;
}

function QuestionImageContent({
  src,
  alt,
  width,
  height,
  critical = false,
  className,
  enableZoom,
  isOption = false,
}: QuestionImageProps) {
  const resolved = src;
  const intrinsic = Boolean(width && height && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0);
  // Upload URLs redirect to signed B2 downloads. Next's internal image fetcher
  // rejects these 302 responses; let the browser follow them directly.
  const isUploadRedirect = /^\/(?:backend-api\/)?api\/upload\/image\//.test(resolved);
  const optimizable = !isUploadRedirect && (resolved.startsWith('/') || /^https:\/\/quizguru12345\.blob\.core\.windows\.net\//i.test(resolved));
  const canZoom = enableZoom ?? !isOption;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!intrinsic && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    }
    setIsLoaded(true);
    setIsError(false);
  };
  const handleError = () => { setIsError(true); setIsLoaded(false); };
  const handleRetry = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsError(false);
    setIsLoaded(false);
    setRetryCount(count => count + 1);
  };
  const handleOpenZoom = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsZoomed(true);
  };
  const handleCloseZoom = () => setIsZoomed(false);

  // Compute aspect ratio: bound raw ratio so mobile displays are never too big or too small
  let rawRatio: number | null = null;
  if (intrinsic) {
    rawRatio = width! / height!;
  } else if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
    rawRatio = naturalSize.width / naturalSize.height;
  }

  // Safe clamped ratio: prevents portrait images from taking entire screen and ultra-wide strips from collapsing
  const safeRatio = rawRatio != null && Number.isFinite(rawRatio) && rawRatio > 0
    ? Math.min(Math.max(rawRatio, isOption ? 0.8 : 0.65), 2.5)
    : (4 / 3);

  const containerRatio = intrinsic
    ? `${width} / ${height}`
    : (rawRatio != null ? `${safeRatio.toFixed(4).replace(/\.?0+$/, '')} / 1` : '4 / 3');

  const containerClasses = [
    styles.container,
    isOption ? styles.optionContainer : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <span
        className={containerClasses}
        style={{
          aspectRatio: `var(--paper-image-aspect, ${containerRatio})`,
          '--natural-img-ratio': rawRatio ?? 4 / 3,
          '--img-ratio': safeRatio,
        } as CSSProperties}
      >
        {/* Shimmer skeleton while loading */}
        {!isLoaded && !isError && (
          <span className={styles.skeleton} aria-hidden="true">
            <span className={styles.spinner} />
          </span>
        )}

        {/* Error placeholder with retry */}
        {isError && (
          <span className={styles.errorState} role="alert">
            <span>Unable to load image</span>
            <button type="button" className={styles.retryBtn} onClick={handleRetry}>
              <RefreshCw size={12} /> Retry
            </button>
          </span>
        )}

        {/* Main image */}
        <Image
          key={`${resolved}-${retryCount}`}
          src={resolved}
          alt={alt}
          fill
          sizes={isOption ? '(max-width: 480px) 180px, 220px' : '(max-width: 480px) 100vw, (max-width: 768px) 85vw, (max-width: 1200px) 70vw, 800px'}
          className={styles.img}
          style={{
            objectFit: 'contain',
            opacity: isLoaded ? 1 : 0,
          }}
          loading={critical ? 'eager' : 'lazy'}
          fetchPriority={critical ? 'high' : 'auto'}
          unoptimized={!optimizable}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Tap to zoom button */}
        {canZoom && isLoaded && !isError && (
          <button
            type="button"
            className={styles.zoomTrigger}
            onClick={handleOpenZoom}
            aria-label="Enlarge image"
            title="Enlarge figure"
          >
            <MoveDiagonal size={16} aria-hidden="true" />
          </button>
        )}
      </span>

      {isZoomed && createPortal(
        <Dialog
          className={styles.modalBackdrop}
          onClose={handleCloseZoom}
          aria-label={alt || 'Enlarged figure'}
          initialFocus="[data-image-close]"
        >
          <button type="button" className={styles.modalDismiss} onClick={handleCloseZoom} aria-label="Dismiss enlarged image" tabIndex={-1} />
          <button type="button" data-image-close className={styles.modalClose} onClick={handleCloseZoom} aria-label="Close enlarged view">
            <X size={20} aria-hidden="true" />
          </button>
          <div className={styles.modalImgWrapper}>
            <Image src={resolved} alt={alt} className={styles.modalImg} width={width || naturalSize?.width || 1600} height={height || naturalSize?.height || 1200} unoptimized />
          </div>
          <div className={styles.modalHint}>Press Escape or close to exit</div>
        </Dialog>, document.body,
      )}
    </>
  );
}
