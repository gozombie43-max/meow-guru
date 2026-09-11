'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import UserProfileMenu from '@/components/UserProfileMenu';
import NotificationBell from '@/components/NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.35)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-blue-500 tracking-tight">
          Meow 🐱
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-neutral-300">Hi, {user.name.split(' ')[0]}</span>
              <Link
                href="/adaptive-quiz"
                className="text-sm font-medium text-neutral-300 hover:text-blue-400 transition"
              >
                Adaptive Quiz
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-neutral-300 hover:text-blue-400 transition"
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
                className="text-sm font-medium text-neutral-300 hover:text-blue-400 transition"
              >
                Adaptive Quiz
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-300 hover:text-blue-400 transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-500 transition"
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
