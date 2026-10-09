'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

const VirtualKeyboardContext = createContext(false);

export function VirtualKeyboardProvider({ children }: { children: ReactNode }) {
  const open = useVirtualKeyboard();
  return <VirtualKeyboardContext.Provider value={open}>{children}</VirtualKeyboardContext.Provider>;
}

export function useKeyboardOpen() {
  return useContext(VirtualKeyboardContext);
}
