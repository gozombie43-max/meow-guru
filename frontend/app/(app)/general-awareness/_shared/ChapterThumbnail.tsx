"use client";

import Image from "next/image";
import type { SyntheticEvent } from "react";

// Chapter list thumbnail: responsive srcset sized to the 88px CSS box, network
// priority only for above-the-fold rows, and a fade-in once the image is decoded.
// The parent box paints a shimmer skeleton until `data-loaded` is set.

const markLoaded = (img: HTMLImageElement) => {
  img.dataset.loaded = "";
};

// Cached images can finish before hydration attaches onLoad, so check on mount.
const syncCached = (img: HTMLImageElement | null) => {
  if (img?.complete && img.naturalWidth > 0) markLoaded(img);
};

const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => markLoaded(event.currentTarget);

export default function ChapterThumbnail({
  src,
  eager = false,
  className,
}: {
  src: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <Image
      ref={syncCached}
      src={src}
      alt=""
      aria-hidden="true"
      width={88}
      height={66}
      sizes="88px"
      quality={75}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "low"}
      decoding="async"
      draggable={false}
      className={className}
      onLoad={handleLoad}
      onError={handleLoad}
    />
  );
}
