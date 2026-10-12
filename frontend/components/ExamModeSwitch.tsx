"use client";
import { Atom } from 'lucide-react';
import { useExamMode } from '@/context/ExamModeContext';
import styles from './exam-mode.module.css';
export default function ExamModeSwitch() {
  const { isJam, setMode } = useExamMode();
  return <button type="button" data-ui-exam-switch="true" role="switch" aria-checked={isJam} className={styles.switch} onClick={() => setMode(isJam ? 'ssc' : 'iit-jam')}>
    <span className={styles.switchIcon}><Atom size={22} /></span><span>IIT JAM Mode</span>
    <span className={styles.track} aria-hidden="true"><span /></span>
  </button>;
}
