'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { RotateCcw, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/context/AuthContext';
import { seedStartResponse, startResponseEpoch } from '@/lib/start-response-cache';
import { startTest } from './api';
import { mockStartStorageKey } from './startKey';
import type { MockTestSlot } from './exam-config';
import styles from './PaperInfoDialog.module.css';

export default function PaperInfoDialog({ slot, canRestart, onClose }: { slot: MockTestSlot; canRestart: boolean; onClose: () => void }) {
  const router = useAppNavigation();
  const { token, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestKey = useRef<string | null>(null);
  const starting = useRef(false);
  const confidential = slot.assessmentMode === 'confidential';

  const restart = async () => {
    if (starting.current || confidential || !canRestart) return;
    if (!token || !user?.id) { router.push('/login'); return; }
    starting.current = true;
    setBusy(true);
    setError('');
    requestKey.current ??= crypto.randomUUID();
    const epoch = startResponseEpoch();
    try {
      const result = await startTest(slot.examSlug, slot.id, token, requestKey.current, true);
      try { sessionStorage.setItem(mockStartStorageKey(user.id, slot.examSlug, slot.id), requestKey.current); } catch { /* Navigation uses the returned attempt directly. */ }
      seedStartResponse(`mock:${slot.examSlug}:${slot.id}`, user.id, result.attemptId, result, epoch);
      router.push(`/mock-test/${slot.examSlug}/${slot.id}/attempt?resume=${encodeURIComponent(result.attemptId)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not restart this test. Please try again.');
      starting.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <div className={styles.overlay}>
      <button type="button" className={styles.backdrop} data-dialog-backdrop data-ui-backdrop aria-label="Dismiss paper info" disabled={busy} onClick={onClose} />
      <Dialog className={styles.dialog} onClose={onClose} busy={busy} initialFocus='[aria-label="Close paper info"]' aria-labelledby="paper-info-title" aria-describedby="paper-info-description">
        <div className={styles.header}><h2 id="paper-info-title">Paper info</h2><button type="button" data-ui-button="icon" aria-label="Close paper info" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></div>
        <h3>{slot.title}</h3>
        <p id="paper-info-description">{confidential ? 'This assessment allows one attempt.' : canRestart ? 'Start again with empty answers and a fresh timer. Previous results stay saved.' : 'Start this paper to begin your first attempt.'}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!confidential && canRestart && <button type="button" data-ui-button="primary" className={styles.restart} disabled={busy} onClick={restart}><RotateCcw size={16} aria-hidden="true" />{busy ? 'Restarting…' : 'Restart test'}</button>}
      </Dialog>
    </div>, document.body
  );
}
