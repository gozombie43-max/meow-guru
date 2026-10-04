'use client';

import NotificationBell from '@/components/NotificationBell';
import UserProfileMenu from '@/components/UserProfileMenu';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.35)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-[var(--ios-system-blue)] tracking-tight">
          Meow 🐱
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-neutral-300">Hi, {user.name.split(' ')[0]}</span>
              <Link
                href="/adaptive-quiz"
                className="text-sm font-medium text-neutral-300 hover:text-[var(--ios-system-blue)] transition"
              >
                Adaptive Quiz
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-neutral-300 hover:text-[var(--ios-system-blue)] transition"
              >
                Dashboard
              </Link>
              <NotificationBell size={34} iconSize={17} />
              <UserProfileMenu size={34} align="right" />
            </>
          ) : (
            <>
              <Link
                href="/adaptive-quiz"
                className="text-sm font-medium text-neutral-300 hover:text-[var(--ios-system-blue)] transition"
              >
                Adaptive Quiz
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-300 hover:text-[var(--ios-system-blue)] transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-[var(--ios-system-blue)] text-white px-4 py-1.5 rounded-full hover:bg-[var(--ios-system-blue)] transition"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
