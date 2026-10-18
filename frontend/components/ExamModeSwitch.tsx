"use client";
import { Atom } from 'lucide-react';
import { useExamMode } from '@/context/ExamModeContext';
import styles from './exam-mode.module.css';
export default function ExamModeSwitch({ compact = false }: { compact?: boolean }) {
  const { isJam, setMode } = useExamMode();
  return <button type="button" data-ui-exam-switch="true" role="switch" aria-label="IIT JAM Mode" aria-checked={isJam} className={compact ? styles.compactSwitch : styles.switch} onClick={() => setMode(isJam ? 'ssc' : 'iit-jam')}>
    {!compact && <span className={styles.switchIcon}><Atom size={22} /></span>}<span>{compact ? 'JAM' : 'IIT JAM Mode'}</span>
    <span className={styles.track} aria-hidden="true"><span /></span>
  </button>;
}
