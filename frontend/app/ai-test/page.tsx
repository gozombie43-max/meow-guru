'use client';

import { useState } from 'react';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { firebaseApp } from '@/lib/firebase/client';
import QuizChatbot from '@/components/QuizChatbot';

const ai = getAI(firebaseApp, {
  backend: new GoogleAIBackend(),
});

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite',
  'gemini-3.8',
  'gemini-3.7-flash',
  'gemini-3.7-flash-lite',
  'gemini-3.7',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5',
];

export default function AITestPage() {
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; text?: string; error?: string }>>({});
  const [customModel, setCustomModel] = useState('');

  async function runModelTest(modelName: string) {
    setActiveModel(modelName);
    setLoading(true);

    try {
      const model = getGenerativeModel(ai, { model: modelName });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timed out after 8s - model not responding or unsupported')), 8000)
      );

      const generatePromise = (async () => {
        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: `Say "Model ${modelName} is working." and nothing else.` }] }
          ],
          generationConfig: {
            maxOutputTokens: 128,
            temperature: 0.1,
          },
        });
        return result.response.text();
      })();

      const text = await Promise.race([generatePromise, timeoutPromise]) as string;
      setResults(prev => ({ ...prev, [modelName]: { success: true, text } }));
    } catch (err) {
      console.error(`Error testing ${modelName}:`, err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setResults(prev => ({ ...prev, [modelName]: { success: false, error: errorMsg } }));
    } finally {
      setLoading(false);
      setActiveModel(null);
    }
  }

  async function runTutorTest(modelName: string, lang: 'bn' | 'hi' | 'en') {
    setActiveModel(`${modelName}-${lang}`);
    setLoading(true);

    try {
      const reply = await (await import('@/components/QuizChatbot/gemini')).requestGeminiTutor({
        context: 'Question: A train 150m long passes a pole in 15 seconds. Find speed of the train in km/h.\nOptions: A) 36 km/h, B) 40 km/h, C) 54 km/h, D) 72 km/h\nCorrect answer: 36 km/h\nSolution: Speed = 150/15 = 10 m/s = 10 * (18/5) = 36 km/h.',
        message: lang === 'bn' ? 'শর্টকাট নিয়ম সহ বিস্তারিত বুঝিয়ে দাও' : lang === 'hi' ? 'शॉर्टकट के साथ स्टेप-बाय-स्टेप समझाएं' : 'Explain step by step with shortcut trick.',
        lang,
        history: [],
        model: modelName,
      });
      setResults(prev => ({ ...prev, [`Tutor (${modelName} [${lang}])`]: { success: true, text: reply } }));
    } catch (err) {
      console.error(`Error in tutor test ${modelName} (${lang}):`, err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setResults(prev => ({ ...prev, [`Tutor (${modelName} [${lang}])`]: { success: false, error: errorMsg } }));
    } finally {
      setLoading(false);
      setActiveModel(null);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, fontFamily: 'sans-serif' }}>
      <h1>Firebase AI Model Diagnostics</h1>
      <p>Testing Gemini 3.8, 3.7, 3.6, and 3.5 variants on Firebase AI / GoogleAIBackend.</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={() => runTutorTest('gemini-3.6-flash', 'bn')}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >
          {loading && activeModel === 'gemini-3.6-flash-bn' ? '⏳ ' : ''}Test 3.6 Flash in AI Tutor (Bengali)
        </button>

        <button
          onClick={() => runTutorTest('gemini-3.5-flash-lite', 'bn')}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >
          {loading && activeModel === 'gemini-3.5-flash-lite-bn' ? '⏳ ' : ''}Test 3.5 Flash Lite in AI Tutor (Bengali)
        </button>

        <button
          onClick={() => runTutorTest('gemini-3.5-flash-lite', 'hi')}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >
          {loading && activeModel === 'gemini-3.5-flash-lite-hi' ? '⏳ ' : ''}Test 3.5 Flash Lite in AI Tutor (Hindi)
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CANDIDATE_MODELS.map(model => (
          <button
            key={model}
            onClick={() => runModelTest(model)}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: results[model]?.success ? '#16a34a' : results[model]?.error ? '#dc2626' : '#f3f4f6',
              color: results[model] ? '#fff' : '#111',
              border: '1px solid #ccc',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {activeModel === model ? '⏳ ' : ''}{model}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          aria-label="Custom model ID"
          value={customModel}
          onChange={(e) => setCustomModel(e.target.value)}
          placeholder="Enter custom model ID (e.g. gemini-3.5-pro)"
          style={{ padding: '6px 12px', width: 300, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={() => customModel.trim() && runModelTest(customModel.trim())}
          disabled={loading || !customModel.trim()}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          Test Custom Model
        </button>
      </div>

      <h2>Results</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(results).map(([model, res]) => (
          <div
            key={model}
            style={{
              padding: 12,
              borderRadius: 6,
              border: `1px solid ${res.success ? '#86efac' : '#fca5a5'}`,
              background: res.success ? '#f0fdf4' : '#fef2f2'
            }}
          >
            <strong>{model}</strong>: {res.success ? '✅ SUCCESS' : '❌ FAILED'}
            {res.text && <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: '#166534' }}>{res.text}</pre>}
            {res.error && <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: '#991b1b' }}>{res.error}</pre>}
          </div>
        ))}
        {Object.keys(results).length === 0 && <p style={{ color: '#666' }}>No tests run yet.</p>}
      </div>

      <div style={{ marginTop: 40 }}>
        <h2>Live AI Tutor Component Preview</h2>
        <p>Click the button below to open the live AI Tutor modal with Gemini models active.</p>
        <QuizChatbot
          isVisible={true}
          questionNumber={24}
          topicTitle="SSC CGL Quantitative Aptitude"
          activeLang="bn"
          question={{
            id: 'q24',
            question: 'If x + 1/x = 5, find x^2 + 1/x^2.',
            options: ['23', '25', '27', '21'],
            answer: '23',
            solution: '(x + 1/x)^2 = x^2 + 1/x^2 + 2 = 25 => x^2 + 1/x^2 = 23.',
            concept: 'Algebra',
          }}
        />
      </div>
    </main>
  );
}