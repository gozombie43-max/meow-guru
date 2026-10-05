'use client';
import Image from 'next/image';
import { API_BASE } from '@/lib/api-base';

export function resolveQuestionImage(src: string) {
  let value = src.trim().replace(/^(https?:\/\/[^/]+\.blob\.core\.windows\.net)\/solutions\//i, '$1/questions/solutions/');
  if (value.startsWith('//')) value = `https:${value}`;
  if (/^https?:\/\//i.test(value)) {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/api/upload/image/')) value = `/backend-api${parsed.pathname}`;
  } else if (value.startsWith('/api/upload/image/')) {
    value = `/backend-api${value}`;
  } else if (!value.startsWith('data:') && !value.startsWith('blob:') && !value.startsWith(`${API_BASE}/`) && !value.startsWith('/backend-api/')) {
    value = `${API_BASE}/${value.replace(/^\//, '')}`;
  }
  return value;
}

export default function QuestionImage({ src, alt, width, height, critical = false, className }: {
  src: string; alt: string; width?: number; height?: number; critical?: boolean; className?: string;
}) {
  const resolved = resolveQuestionImage(src);
  const intrinsic = Boolean(width && height && width > 0 && height > 0);
  const optimizable = resolved.startsWith('/') || /^https:\/\/quizguru12345\.blob\.core\.windows\.net\//i.test(resolved);
  return <span className={className} style={{ display: 'block', position: 'relative', width: '100%',
    aspectRatio: intrinsic ? `${width} / ${height}` : '4 / 3', borderRadius: 12, overflow: 'hidden' }}>
    <Image src={resolved} alt={alt} fill sizes="(max-width: 768px) calc(100vw - 40px), (max-width: 1200px) 70vw, 800px"
      style={{ objectFit: 'contain' }} loading={critical ? 'eager' : 'lazy'} fetchPriority={critical ? 'high' : 'auto'}
      unoptimized={!optimizable} />
  </span>;
}
