import Image from 'next/image';

type TopicThumbnailProps = {
  src: string;
  size?: number;
  priority?: boolean;
};

export default function TopicThumbnail({ src, size = 44, priority = false }: TopicThumbnailProps) {
  return (
    <Image
      data-topic-thumbnail=""
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
      style={{ objectFit: 'cover', borderRadius: 'inherit' }}
    />
  );
}
