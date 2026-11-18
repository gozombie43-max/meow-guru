'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNativeDialog } from '@/components/ui/Dialog';
import AuthFlow from '@/components/auth/AuthFlow';
import styles from './AuthGate.module.css';

/** Routes a signed-out visitor may open. Everything else requires an account. */
const PUBLIC_PATHS = new Set(['/', '/access-code', '/login', '/register']);

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_PATHS.has(normalized);
}

function AuthRequiredModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useNativeDialog(dialogRef, true, onClose, { back: false });

  useEffect(() => {
    const dialog = dialogRef.current;
    const dismissBackdrop = (event: MouseEvent) => {
      if (!dialog || event.target !== dialog) return;
      const b = dialog.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) onClose();
    };
    dialog?.addEventListener('click', dismissBackdrop);
    return () => dialog?.removeEventListener('click', dismissBackdrop);
  }, [onClose]);

  return createPortal(
    <dialog ref={dialogRef} className={styles.dialog} aria-label="Sign in or create an account">
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        <X size={18} aria-hidden="true" />
      </button>
      <AuthFlow mode="signup" embedded modeSwitch="link" onSuccess={onSuccess} />
    </dialog>,
    document.body,
  );
}

/**
 * Blocks every non-public page for signed-out visitors and shows a
 * Sign in / Create account modal instead. Links clicked on public pages are
 * intercepted so guests stay on the home page while the modal is shown.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const isPublic = isPublicPath(pathname);
  const signedIn = Boolean(user);
  const blocked = !loading && !isPublic && !signedIn;

  // Intercept in-app link clicks for guests before Next.js navigates.
  useEffect(() => {
    if (loading || signedIn) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || isPublicPath(url.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [loading, signedIn]);

  const closeModal = useCallback(() => {
    setPendingHref(null);
    if (!isPublicPath(window.location.pathname)) router.replace('/');
  }, [router]);

  const onSuccess = useCallback(() => {
    const target = pendingHref;
    setPendingHref(null);
    if (target) router.push(target);
  }, [pendingHref, router]);

  if (blocked) {
    return (
      <>
        <div className={styles.lockedPage} aria-hidden="true" />
        <AuthRequiredModal onClose={closeModal} onSuccess={onSuccess} />
      </>
    );
  }

  return (
    <>
      {children}
      {pendingHref && !signedIn && <AuthRequiredModal onClose={closeModal} onSuccess={onSuccess} />}
    </>
  );
}
