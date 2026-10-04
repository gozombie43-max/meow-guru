"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canManageNotes } from './permissions';

export default function NoteWriteAccess({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = canManageNotes(user?.role);
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!allowed) router.replace('/notes');
  }, [allowed, loading, router, user]);
  if (loading) return <p role="status">Checking notes access…</p>;
  return allowed ? children : null;
}
