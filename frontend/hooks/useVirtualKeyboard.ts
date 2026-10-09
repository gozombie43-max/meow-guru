'use client';

import { useEffect, useState } from 'react';

function isTextEntry(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  return element instanceof HTMLInputElement && !element.disabled && !element.readOnly &&
    element.inputMode !== 'none' &&
    ['text', 'search', 'email', 'password', 'tel', 'url', 'number'].includes(element.type);
}

/** Viewport shrink detection also covers WebViews that resize window.innerHeight. */
export function useVirtualKeyboard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const touch = window.matchMedia('(any-pointer: coarse)');
    let baseline = window.innerHeight;
    let baselineWidth = window.innerWidth;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    let keyboardSearch: HTMLInputElement | null = null;

    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      // Rotation/window resizing invalidates the previous height baseline.
      if (Math.abs(window.innerWidth - baselineWidth) > 100) {
        baseline = window.innerHeight;
        baselineWidth = window.innerWidth;
        keyboardSearch = null;
      }
      const editing = isTextEntry(document.activeElement);
      const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.05;
      const shrunk = Math.max(baseline, window.innerHeight) - height > 150;
      const activeElement = document.activeElement;
      // Dismissing the keyboard can leave the search focused and its caret active.
      // Only blur the search that owned a confirmed keyboard, after height recovers.
      if (touch.matches && !zoomed && shrunk && editing) {
        keyboardSearch = activeElement instanceof HTMLInputElement && activeElement.type === 'search'
          ? activeElement : null;
      } else if (!zoomed && !shrunk) {
        if (keyboardSearch === activeElement) keyboardSearch?.blur();
        keyboardSearch = null;
      } else if (activeElement !== keyboardSearch) {
        keyboardSearch = null;
      }
      setOpen(touch.matches && !zoomed && isTextEntry(document.activeElement) && (shrunk || !viewport));
      if ((!editing && !shrunk) || height > baseline) baseline = window.innerHeight;
    };
    const onFocus = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(update, 0);
    };

    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    touch.addEventListener('change', update);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('resize', update);
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
      touch.removeEventListener('change', update);
    };
  }, []);

  return open;
}
