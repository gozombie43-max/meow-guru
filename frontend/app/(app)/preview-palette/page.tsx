'use client';

import React, { useState } from 'react';
import { X, FileCheck2, ArrowLeft, MoreVertical, Clock } from 'lucide-react';

export default function PalettePreviewPage() {
  const [activeSubject, setActiveSubject] = useState('GK');
  const [currentQuestion, setCurrentQuestion] = useState(9);
  const [isOpen, setIsOpen] = useState(true);

  // Status mapping matching user's exact specification & screenshot:
  // 1-8 Answered, 9 Current, 10 Not Visited, 11 Marked, 12-25 Not Visited
  const [questionStatuses] = useState<Record<number, 'answered' | 'current' | 'marked' | 'not-visited'>>({
    1: 'answered',
    2: 'answered',
    3: 'answered',
    4: 'answered',
    5: 'answered',
    6: 'answered',
    7: 'answered',
    8: 'answered',
    9: 'current',
    10: 'not-visited',
    11: 'marked',
    12: 'not-visited',
    13: 'not-visited',
    14: 'not-visited',
    15: 'not-visited',
    16: 'not-visited',
    17: 'not-visited',
    18: 'not-visited',
    19: 'not-visited',
    20: 'not-visited',
    21: 'not-visited',
    22: 'not-visited',
    23: 'not-visited',
    24: 'not-visited',
    25: 'not-visited',
  });

  const getQuestionStyle = (num: number) => {
    if (num === currentQuestion) {
      return {
        backgroundColor: '#1565C0',
        border: '2px solid #1D85F6',
        color: '#ffffff',
        boxShadow: '0 0 14px rgba(29, 133, 246, 0.65)',
        fontWeight: 700,
        transform: 'scale(1.02)',
      };
    }
    const status = questionStatuses[num] || 'not-visited';
    switch (status) {
      case 'answered':
        return {
          backgroundColor: '#2E7D32',
          border: '1px solid #388E3C',
          color: '#ffffff',
          fontWeight: 600,
        };
      case 'marked':
        return {
          backgroundColor: '#7B1FA2',
          border: '1px solid #8E24AA',
          color: '#ffffff',
          fontWeight: 600,
        };
      case 'not-visited':
      default:
        return {
          backgroundColor: '#35383F',
          border: '1px solid #4A4D52',
          color: '#B0B4BC',
          fontWeight: 600,
        };
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', backgroundColor: '#121316', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Blurred / Dimmed Quiz Interface in background */}
      <div style={{ padding: '16px', filter: isOpen ? 'blur(4px) brightness(0.6)' : 'none', transition: 'filter 0.3s ease', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9EA2A8', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={20} />
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>SSC CGL Tier 1 Mock Test</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1E1F22', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', color: '#fff' }}>
              <Clock size={14} /> 54:20
            </div>
            <MoreVertical size={20} />
          </div>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: '#1E1F22', borderRadius: '16px', border: '1px solid #2E3035' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9EA2A8', marginBottom: '12px' }}>
            <span>Question 9 of 25</span>
            <span style={{ color: '#2E7D32' }}>+2.0 / -0.5</span>
          </div>
          <p style={{ color: '#fff', fontSize: '16px', lineHeight: 1.5, margin: 0 }}>
            Who among the following was the founder of the Kanva dynasty in ancient India?
          </p>
        </div>

        {!isOpen && (
          <div style={{ marginTop: 'auto', paddingBottom: '120px', zIndex: 60, position: 'relative' }}>
            <button
              onClick={() => setIsOpen(true)}
              style={{ width: '100%', height: '48px', borderRadius: '9999px', background: '#1982FC', color: '#fff', border: 'none', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
            >
              Open Questions Palette
            </button>
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close Questions Palette"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 90,
            border: 'none',
            padding: 0,
            cursor: 'default',
          }}
        />
      )}

      {/* Bottom Sheet Container */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '430px',
            backgroundColor: '#1E1F22',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            borderTop: '1px solid #3E4047',
            padding: '12px 18px 24px',
            zIndex: 100,
            boxShadow: '0 -16px 44px rgba(0, 0, 0, 0.6)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Questions Palette"
        >
          {/* Centered Drag Handle Pill */}
          <div
            style={{
              width: '48px',
              height: '5px',
              borderRadius: '9999px',
              backgroundColor: '#55585D',
              margin: '0 auto 12px',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />

          {/* Header (3-col grid avoids absolute transform collisions with tap-scale) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr 44px',
              alignItems: 'center',
              marginBottom: '14px',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                gridColumn: 2,
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: '#ffffff',
                textAlign: 'center',
                letterSpacing: '-0.01em',
              }}
            >
              Questions Palette
            </h2>
            <button
              type="button"
              data-palette-close
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              style={{
                gridColumn: 3,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9EA2A8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                padding: '4px',
              }}
            >
              <X size={20} style={{ pointerEvents: 'none' }} />
            </button>
          </div>

          {/* Subject Filter Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '14px',
              flexShrink: 0,
            }}
          >
            {['Math', 'English', 'Reasoning', 'GK'].map((sub) => {
              const isActive = activeSubject === sub;
              return (
                <button
                  key={sub}
                  onClick={() => setActiveSubject(sub)}
                  style={{
                    height: '38px',
                    borderRadius: '9999px',
                    border: isActive ? '1px solid #1D85F6' : '1px solid #3E4047',
                    backgroundColor: isActive ? '#0E2849' : 'rgba(42, 43, 48, 0.45)',
                    color: isActive ? '#3898EC' : '#9EA2A8',
                    boxShadow: isActive ? '0 0 12px rgba(29, 133, 246, 0.4)' : 'none',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {sub}
                </button>
              );
            })}
          </div>

          {/* Status Legend Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 2px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '14px',
              fontSize: '11px',
              color: '#A5A9B0',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2E7D32', display: 'inline-block' }} />
              <span>Answered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4A4D54', display: 'inline-block' }} />
              <span>Not Visited</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7B1FA2', display: 'inline-block' }} />
              <span>Marked for Review</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1976D2', display: 'inline-block' }} />
              <span>Current</span>
            </div>
          </div>

          {/* 5x5 Questions Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setCurrentQuestion(num)}
                style={{
                  height: '48px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                  ...getQuestionStyle(num),
                }}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Primary CTA Submit Button */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', flexShrink: 0 }}>
            <button
              onClick={() => alert('Test submitted successfully!')}
              style={{
                width: '100%',
                height: '50px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #1982FC 0%, #0D6EFD 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(17, 123, 245, 0.35)',
                cursor: 'pointer',
                transition: 'transform 0.1s ease',
              }}
            >
              <span>Submit Test</span>
              <FileCheck2 size={18} color="#ffffff" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
