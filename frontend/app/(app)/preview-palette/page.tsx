import { notFound } from 'next/navigation';
import PalettePreviewClient from './PalettePreviewClient';

export default function PalettePreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <PalettePreviewClient />;
}
