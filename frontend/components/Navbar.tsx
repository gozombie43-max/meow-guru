'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/40 backdrop-blur-xl border-b border-white/50 shadow-[0_4px_30px_rgba(0,0,0,0.05)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-indigo-600 tracking-tight">
          Meow 🐱
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-600">Hi, {user.name.split(' ')[0]}</span>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/70 bg-indigo-100 text-sm font-bold text-indigo-700 shadow-sm transition hover:border-indigo-300"
                aria-label="Logout"
                title="Logout"
              >
                {user.avatar ? (
                  <span
                    aria-hidden="true"
                    className="block h-full w-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${user.avatar}")` }}
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-indigo-600 text-white px-4 py-1.5 rounded-full hover:bg-indigo-700 transition"
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
