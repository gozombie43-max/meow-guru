"use client";

import Image from 'next/image';
import type { SyntheticEvent } from 'react';
import styles from './TopicThumbnail.module.css';

type TopicThumbnailProps = {
  src: string;
  size?: number;
  priority?: boolean;
};

// The <img> paints a neutral shimmer skeleton (never a black box) until the
// WebP is decoded, then fades in. `data-loaded` drives the CSS transition.
const markLoaded = (img: HTMLImageElement) => {
  img.dataset.loaded = '';
};

// Cached images can finish before hydration attaches onLoad, so check on mount.
const syncCached = (img: HTMLImageElement | null) => {
  if (img?.complete && img.naturalWidth > 0) markLoaded(img);
};

const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => markLoaded(event.currentTarget);

export default function TopicThumbnail({ src, size = 44, priority = false }: TopicThumbnailProps) {
  return (
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
  );
}
