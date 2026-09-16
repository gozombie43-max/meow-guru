'use client';

import { useState } from 'react';
import { meowAIModel, fallbackAIModel } from '@/lib/firebase/ai';

export default function AITestPage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  async function testModel(engine: typeof meowAIModel, name: string) {
    setLoading(true);
    setResponse('');
    setError('');

    try {
      const result = await engine.generateContent(
        `Reply with exactly: ${name} is working.`
      );

      setResponse(result.response.text());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Firebase AI Logic Test</h1>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={() => testModel(meowAIModel, 'Gemini 3.8 Flash')} disabled={loading}>
          {loading ? 'Testing...' : 'Test Gemini 3.8'}
        </button>

        <button onClick={() => testModel(fallbackAIModel, 'Gemini 3.7 Flash')} disabled={loading}>
          {loading ? 'Testing...' : 'Test Gemini 3.7'}
        </button>
      </div>

      {response && (
        <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap' }}>
          {response}
        </pre>
      )}

      {error && (
        <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      )}
    </main>
  );
}