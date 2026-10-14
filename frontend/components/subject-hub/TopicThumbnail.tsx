export default function TopicThumbnail({ src, size = 44 }: { src: string; size?: number }) {
  return <img data-topic-thumbnail="" src={src} alt="" aria-hidden="true" width={size} height={size} loading="lazy" decoding="async" draggable={false} style={{ objectFit: "cover", borderRadius: "inherit" }} />;
}
