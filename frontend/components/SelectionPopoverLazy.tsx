'use client';

import dynamic from 'next/dynamic';

const SelectionPopover = dynamic(() => import('@/components/SelectionPopover'), {
  ssr: false,
});

export default function SelectionPopoverLazy() {
  return <SelectionPopover />;
}
