import React from 'react';
import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px 28px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(220, 230, 245, 0.8)',
          boxShadow: '0 12px 36px rgba(0, 50, 100, 0.08)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(14, 165, 233, 0.1)',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Compass size={32} />
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 6px',
            letterSpacing: '-0.02em',
          }}
        >
          404
        </h1>

        <h2
          style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: '#334155',
            margin: '0 0 10px',
          }}
        >
          Page Not Found
        </h2>

        <p
          style={{
            fontSize: '0.9rem',
            color: '#64748b',
            lineHeight: 1.5,
            margin: '0 0 24px',
          }}
        >
          The page or quiz you are looking for does not exist, has been moved, or is temporarily unavailable.
        </p>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 22px',
            borderRadius: '12px',
            background: '#0ea5e9',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.92rem',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)',
          }}
        >
          <Home size={18} /> Back to Home
        </Link>
      </div>
    </main>
  );
}
