'use client';

import React from 'react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            textAlign: 'center',
            padding: '32px',
            borderRadius: '20px',
            background: '#ffffff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0',
          }}
        >
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px' }}>
            Application Error
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
            A critical error occurred. Please reload the application.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
