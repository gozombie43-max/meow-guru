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
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur border-b border-gray-100">
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
                className="text-sm font-medium text-red-500 hover:text-red-700 transition"
              >
                Logout
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