"use client";

import Image from 'next/image';
import type { SyntheticEvent } from 'react';
import styles from './TopicThumbnail.module.css';

type TopicThumbnailProps = {
  src: string;
  size?: number;
  priority?: boolean;
};

// Keep the shimmer on the wrapper frame underneath while uncached images fade
// in cleanly; already-decoded cached images skip the fade via data-cached.
const markReady = (img: HTMLImageElement, cached: boolean) => {
  if (cached) img.dataset.cached = '';
  img.dataset.loaded = '';
  img.parentElement?.setAttribute('data-loaded', '');
};

// Cached images can finish before hydration attaches onLoad, so check on mount.
const syncCached = (img: HTMLImageElement | null) => {
  if (img?.complete && img.naturalWidth > 0) markReady(img, true);
};

const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
  markReady(event.currentTarget, false);
};

export default function TopicThumbnail({ src, size = 44, priority = false }: TopicThumbnailProps) {
  return (
    <span key={src} className={styles.frame}>
      <Image
        ref={syncCached}
        data-topic-thumbnail=""
        className={styles.thumb}
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        sizes={`${size}px`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        draggable={false}
        onLoad={handleLoad}
        onError={handleLoad}
        style={{ objectFit: 'cover', borderRadius: 'inherit' }}
      />
    </span>
  );
}
