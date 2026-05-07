'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { useAuth } from '@/context/AuthContext';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['700'] });

/* ─────────── DATA ─────────── */

const featuredModes = [
  {
    title: 'Exam Sim',
    copy: 'Real exam pressure',
    badge: '🔥 Hot',
    theme: 'green',
    mascot: 'clock',
  },
  {
    title: 'AI Adaptive',
    copy: 'Personalized path',
    badge: '🤖 AI',
    theme: 'blue',
    mascot: 'robot',
  },
  {
    title: 'Weak Target',
    copy: 'Fix weak spots',
    badge: '📈 Up',
    theme: 'purple',
    mascot: 'graph',
  },
];

const allModes = [
  { title: 'Exam Simulation Mode', copy: 'Full mock · Timer · Negative marking', accent: '#00e87a', gradient: 'linear-gradient(135deg,#00703f,#00e87a)', icon: 'exam' },
  { title: 'Adaptive AI Mode', copy: 'Dynamic difficulty · Instant explain', accent: '#3b8fff', gradient: 'linear-gradient(135deg,#1a5fbf,#3b8fff)', icon: 'ai' },
  { title: 'Weak Area Target', copy: 'Focused weak topic questions', accent: '#a855f7', gradient: 'linear-gradient(135deg,#6d28d9,#a855f7)', icon: 'target' },
  { title: 'Revision Mode', copy: 'Spaced recall · Mixed past attempts', accent: '#ff7c2a', gradient: 'linear-gradient(135deg,#b84900,#ff7c2a)', icon: 'revision' },
  { title: 'Mistake Analysis', copy: 'Wrong-only · Deep explanations', accent: '#ff3d5a', gradient: 'linear-gradient(135deg,#9b0020,#ff3d5a)', icon: 'mistake' },
  { title: 'Speed Drill Mode', copy: 'Short timer · Rapid fire questions', accent: '#ffd600', gradient: 'linear-gradient(135deg,#a38900,#ffd600)', icon: 'speed' },
  { title: 'Accuracy Mode', copy: 'Heavy penalty · Precision training', accent: '#00d4ff', gradient: 'linear-gradient(135deg,#0087a3,#00d4ff)', icon: 'accuracy' },
  { title: 'Sectional Practice', copy: 'Quant · Reasoning · English · GK', accent: '#ff4fa3', gradient: 'linear-gradient(135deg,#a3006a,#ff4fa3)', icon: 'sectional' },
  { title: 'PYQ Mode', copy: 'Previous year papers only', accent: '#00e87a', gradient: 'linear-gradient(135deg,#005c31,#00e87a)', icon: 'pyq' },
  { title: 'Concept Builder', copy: 'Topic-wise · Deep fundamentals', accent: '#a855f7', gradient: 'linear-gradient(135deg,#4c1d95,#a855f7)', icon: 'concept' },
];

const searchModes = allModes.map((m, i) => ({
  icon: ['⏱️', '🤖', '🎯', '🔁', '❌', '⚡', '🎯', '📊', '🔮', '🧩'][i],
  name: m.title,
}));

const subjectCards = [
  { title: 'Mathematics', copy: 'Geometry, algebra, arithmetic', accent: '#00e87a' },
  { title: 'Reasoning', copy: 'Logic, sequences, patterns', accent: '#3b8fff' },
  { title: 'English', copy: 'Grammar, vocab, comprehension', accent: '#a855f7' },
  { title: 'General Awareness', copy: 'Static GK, history, polity', accent: '#ffb547' },
];

/* ─────────── SVG MASCOTS ─────────── */

function FoxMascot() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="foxBody" x1="60" y1="40" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff9a3c" />
          <stop offset="100%" stopColor="#ff6b2c" />
        </linearGradient>
        <linearGradient id="foxBelly" x1="60" y1="70" x2="60" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe4c7" />
          <stop offset="100%" stopColor="#ffcfa0" />
        </linearGradient>
        {/* 3D Sheen gradient for fox body */}
        <radialGradient id="foxSheen" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="foxShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#ff6b2c" floodOpacity="0.35" />
        </filter>
        <filter id="foxGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="126" rx="36" ry="6" fill="rgba(255,107,44,0.18)" style={{ animation: 'foxShadowPulse 4s ease-in-out infinite' }} />

      {/* Tail with 3D depth */}
      <g style={{ animation: 'foxTail 2.5s ease-in-out infinite', transformOrigin: '35px 105px' }}>
        <ellipse cx="28" cy="108" rx="24" ry="14" fill="url(#foxBody)" transform="rotate(-15 28 108)" filter="url(#foxShadow)" />
        <ellipse cx="20" cy="112" rx="12" ry="8" fill="url(#foxBelly)" transform="rotate(-15 20 112)" />
        {/* Tail tip highlight */}
        <ellipse cx="16" cy="115" rx="5" ry="3" fill="rgba(255,255,255,0.3)" transform="rotate(-15 16 115)" />
      </g>

      {/* Body */}
      <ellipse cx="60" cy="95" rx="34" ry="28" fill="url(#foxBody)" filter="url(#foxShadow)" />
      <ellipse cx="60" cy="95" rx="34" ry="28" fill="url(#foxSheen)" />
      <ellipse cx="60" cy="100" rx="20" ry="16" fill="url(#foxBelly)" />

      {/* Legs */}
      <rect x="38" y="118" width="14" height="12" rx="7" fill="url(#foxBody)" />
      <rect x="68" y="118" width="14" height="12" rx="7" fill="url(#foxBody)" />
      {/* Paw highlights */}
      <ellipse cx="45" cy="128" rx="5" ry="2.5" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="75" cy="128" rx="5" ry="2.5" fill="rgba(255,255,255,0.2)" />

      {/* Head group with 3D breathe */}
      <g style={{ animation: 'foxBreathe 3s ease-in-out infinite', transformOrigin: '60px 55px' }} filter="url(#foxShadow)">
        {/* Ear left */}
        <g style={{ animation: 'foxEarLeft 4s ease-in-out infinite', transformOrigin: '38px 25px' }}>
          <path d="M28 38 L22 8 L42 24 Z" fill="url(#foxBody)" />
          <path d="M30 35 L26 14 L38 26 Z" fill="#ff3d5a" />
          <path d="M31 33 L27 17 L36 27 Z" fill="rgba(255,255,255,0.15)" />
        </g>
        {/* Ear right */}
        <g style={{ animation: 'foxEarRight 4s ease-in-out infinite 0.2s', transformOrigin: '82px 25px' }}>
          <path d="M72 38 L78 8 L58 24 Z" fill="url(#foxBody)" />
          <path d="M70 35 L74 14 L62 26 Z" fill="#ff3d5a" />
          <path d="M69 33 L73 17 L64 27 Z" fill="rgba(255,255,255,0.15)" />
        </g>
        {/* Head sphere */}
        <circle cx="60" cy="52" r="28" fill="url(#foxBody)" />
        {/* 3D highlight on head */}
        <ellipse cx="52" cy="40" rx="14" ry="10" fill="rgba(255,255,255,0.2)" transform="rotate(-15 52 40)" />
        <ellipse cx="60" cy="58" rx="16" ry="14" fill="url(#foxBelly)" />
        {/* Eyes with blink */}
        <g style={{ animation: 'foxBlink 5s ease-in-out infinite' }}>
          {/* Eye sockets with depth */}
          <circle cx="50" cy="48" r="7" fill="rgba(0,0,0,0.15)" />
          <circle cx="70" cy="48" r="7" fill="rgba(0,0,0,0.15)" />
          <circle cx="50" cy="48" r="6" fill="#1a0a00" />
          <circle cx="70" cy="48" r="6" fill="#1a0a00" />
          {/* Iris shine */}
          <circle cx="52" cy="46" r="2.5" fill="#fff" />
          <circle cx="72" cy="46" r="2.5" fill="#fff" />
          {/* Tiny sparkle */}
          <circle cx="54" cy="44" r="1" fill="rgba(255,255,255,0.8)" />
          <circle cx="74" cy="44" r="1" fill="rgba(255,255,255,0.8)" />
        </g>
        {/* Nose */}
        <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#1a0a00" />
        <ellipse cx="59" cy="55.5" rx="1.2" ry="0.8" fill="rgba(255,255,255,0.3)" />
        {/* Smile */}
        <path d="M50 62 Q60 72 70 62" stroke="#1a0a00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Cheeks */}
        <ellipse cx="42" cy="58" rx="6" ry="4" fill="#ff9eb5" opacity="0.5" />
        <ellipse cx="78" cy="58" rx="6" ry="4" fill="#ff9eb5" opacity="0.5" />
        {/* Whiskers */}
        <line x1="44" y1="59" x2="30" y2="57" stroke="rgba(0,0,0,0.25)" strokeWidth="1" strokeLinecap="round" />
        <line x1="44" y1="61" x2="30" y2="63" stroke="rgba(0,0,0,0.25)" strokeWidth="1" strokeLinecap="round" />
        <line x1="76" y1="59" x2="90" y2="57" stroke="rgba(0,0,0,0.25)" strokeWidth="1" strokeLinecap="round" />
        <line x1="76" y1="61" x2="90" y2="63" stroke="rgba(0,0,0,0.25)" strokeWidth="1" strokeLinecap="round" />
      </g>

      {/* Floating sparkles around fox */}
      <g style={{ animation: 'sparkle1 3s ease-in-out infinite' }}>
        <path d="M100 30 L102 26 L104 30 L108 32 L104 34 L102 38 L100 34 L96 32 Z" fill="#ffd600" opacity="0.8" />
      </g>
      <g style={{ animation: 'sparkle2 4s ease-in-out infinite 1s' }}>
        <path d="M14 45 L15.5 42 L17 45 L20 46.5 L17 48 L15.5 51 L14 48 L11 46.5 Z" fill="#ff3d5a" opacity="0.7" />
      </g>
      <g style={{ animation: 'sparkle1 3.5s ease-in-out infinite 0.5s' }}>
        <circle cx="105" cy="70" r="3" fill="#3b8fff" opacity="0.6" />
        <circle cx="107" cy="70" r="1" fill="#fff" opacity="0.9" />
      </g>
    </svg>
  );
}

function ClockMascot() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
      <defs>
        <radialGradient id="clockFace3D" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f5f5f5" />
          <stop offset="100%" stopColor="#e0e0e0" />
        </radialGradient>
        <radialGradient id="clockBezel" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#fff9c4" />
          <stop offset="50%" stopColor="#ffcc00" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
        <filter id="clockDepth">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.25)" />
        </filter>
        <filter id="handGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Clock shadow */}
      <ellipse cx="41" cy="72" rx="28" ry="5" fill="rgba(0,0,0,0.12)" style={{ animation: 'clockShadow 3s ease-in-out infinite' }} />

      {/* Outer pulse ring */}
      <circle cx="40" cy="40" r="32" fill="none" stroke="#ff3d5a" strokeWidth="1.5" opacity="0.3" style={{ animation: 'clockPulse 2s ease-in-out infinite' }} />

      {/* Bezel (3D ring) */}
      <circle cx="40" cy="40" r="30" fill="url(#clockBezel)" filter="url(#clockDepth)" />
      {/* Bezel highlight */}
      <ellipse cx="32" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.4)" transform="rotate(-20 32 22)" />

      {/* Clock face */}
      <circle cx="40" cy="40" r="26" fill="url(#clockFace3D)" />
      {/* Inner ring subtle */}
      <circle cx="40" cy="40" r="26" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />

      {/* Hour markers */}
      <g stroke="#bbb" strokeWidth="1.5" strokeLinecap="round">
        <line x1="40" y1="16" x2="40" y2="20" />
        <line x1="40" y1="60" x2="40" y2="64" />
        <line x1="16" y1="40" x2="20" y2="40" />
        <line x1="60" y1="40" x2="64" y2="40" />
      </g>
      {/* Minor tick marks */}
      <g stroke="#ddd" strokeWidth="1" strokeLinecap="round" opacity="0.7">
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(30 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(60 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(120 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(150 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(210 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(240 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(300 40 40)" />
        <line x1="40" y1="16" x2="40" y2="18" transform="rotate(330 40 40)" />
      </g>

      {/* Hour hand */}
      <line x1="40" y1="40" x2="40" y2="26" stroke="#2d2d2d" strokeWidth="3.5" strokeLinecap="round" />

      {/* Minute / sweep hand */}
      <g style={{ animation: 'clockSweep 6s linear infinite', transformOrigin: '40px 40px' }}>
        <line x1="40" y1="40" x2="40" y2="17" stroke="#ff3d5a" strokeWidth="2.5" strokeLinecap="round" filter="url(#handGlow)" style={{ animation: 'clockGlow 1.5s ease-in-out infinite' }} />
        {/* Counterweight */}
        <line x1="40" y1="40" x2="40" y2="46" stroke="#ff3d5a" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Center cap — 3D raised */}
      <circle cx="40" cy="40" r="5" fill="#2d2d2d" />
      <circle cx="40" cy="40" r="3" fill="#ff3d5a" />
      <circle cx="39" cy="39" r="1.2" fill="rgba(255,255,255,0.5)" />

      {/* Tiny floating star */}
      <g style={{ animation: 'iconFloat 2.5s ease-in-out infinite' }}>
        <path d="M62 18 Q65 22 62 28 Q59 22 62 18Z" fill="#60c5ff" opacity="0.9" />
      </g>

      {/* Clock face expression */}
      <path d="M28 33 Q31 30 34 32" stroke="#888" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M46 32 Q49 30 52 33" stroke="#888" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="31" cy="36" rx="2.5" ry="3" fill="#555" />
      <ellipse cx="49" cy="36" rx="2.5" ry="3" fill="#555" />
      <circle cx="32" cy="35" r="1" fill="#fff" opacity="0.7" />
      <circle cx="50" cy="35" r="1" fill="#fff" opacity="0.7" />
      <path d="M29 46 Q40 40 51 46" stroke="#888" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function RobotMascot() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
      <defs>
        <linearGradient id="robotBody3D" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="40%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <radialGradient id="robotSheen" cx="30%" cy="25%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="robotGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="robotDepth">
          <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="rgba(37,99,235,0.4)" />
        </filter>
      </defs>

      {/* Shadow */}
      <ellipse cx="40" cy="74" rx="26" ry="4" fill="rgba(37,99,235,0.2)" style={{ animation: 'robotShadow 2.5s ease-in-out infinite' }} />

      {/* Body */}
      <rect x="22" y="42" width="36" height="26" rx="8" fill="url(#robotBody3D)" filter="url(#robotDepth)" />
      <rect x="22" y="42" width="36" height="26" rx="8" fill="url(#robotSheen)" />

      {/* Body panel details */}
      <rect x="28" y="48" width="10" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
      <rect x="42" y="48" width="10" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
      {/* Glow for eye slots */}
      <rect x="29" y="49" width="8" height="4" rx="2" fill="#00d4ff" opacity="0.9" style={{ animation: 'scanBeam 2s ease-in-out infinite' }} />
      <rect x="43" y="49" width="8" height="4" rx="2" fill="#00d4ff" opacity="0.9" style={{ animation: 'scanBeam 2s ease-in-out infinite 0.3s' }} />

      {/* Chest display */}
      <rect x="29" y="58" width="22" height="6" rx="3" fill="rgba(0,0,0,0.3)" />
      <rect x="31" y="59.5" width="5" height="3" rx="1.5" fill="#00d4ff" opacity="0.9" />
      <rect x="38" y="59.5" width="5" height="3" rx="1.5" fill="#00e87a" opacity="0.9" />
      <rect x="45" y="59.5" width="5" height="3" rx="1.5" fill="#ff3d5a" opacity="0.9" />

      {/* Neck */}
      <rect x="34" y="36" width="12" height="8" rx="3" fill="#1d4ed8" />
      <rect x="36" y="37" width="8" height="4" rx="2" fill="rgba(255,255,255,0.15)" />

      {/* Head - floats */}
      <g style={{ animation: 'robotFloat 2.5s ease-in-out infinite' }} filter="url(#robotDepth)">
        <rect x="18" y="14" width="44" height="24" rx="10" fill="url(#robotBody3D)" />
        <rect x="18" y="14" width="44" height="24" rx="10" fill="url(#robotSheen)" />

        {/* Antenna */}
        <line x1="40" y1="14" x2="40" y2="6" stroke="#1d4ed8" strokeWidth="2.5" />
        <circle cx="40" cy="5" r="3.5" fill="#00d4ff" filter="url(#robotGlow)" style={{ animation: 'antennaPulse 2s ease-in-out infinite' }} />
        {/* Antenna ring */}
        <circle cx="40" cy="5" r="5.5" fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.4" style={{ animation: 'antennaPulse 2s ease-in-out infinite' }} />

        {/* Eye panels */}
        <rect x="23" y="20" width="13" height="11" rx="4" fill="#0f172a" />
        <rect x="44" y="20" width="13" height="11" rx="4" fill="#0f172a" />
        {/* Eye glow */}
        <rect x="25" y="22" width="9" height="7" rx="2.5" fill="#00d4ff" opacity="0.95" style={{ animation: 'eyeFlicker 3s ease-in-out infinite' }} />
        <rect x="46" y="22" width="9" height="7" rx="2.5" fill="#00d4ff" opacity="0.95" style={{ animation: 'eyeFlicker 3s ease-in-out infinite 0.5s' }} />
        {/* Eye shine */}
        <rect x="26" y="23" width="3" height="2" rx="1" fill="rgba(255,255,255,0.6)" />
        <rect x="47" y="23" width="3" height="2" rx="1" fill="rgba(255,255,255,0.6)" />

        {/* Mouth bar */}
        <rect x="30" y="33" width="20" height="2.5" rx="1.25" fill="rgba(255,255,255,0.35)" />
        <circle cx="34" cy="34.25" r="1.2" fill="rgba(255,255,255,0.8)" />
        <circle cx="40" cy="34.25" r="1.2" fill="rgba(255,255,255,0.8)" />
        <circle cx="46" cy="34.25" r="1.2" fill="rgba(255,255,255,0.8)" />

        {/* 3D head sheen */}
        <ellipse cx="30" cy="18" rx="10" ry="5" fill="rgba(255,255,255,0.15)" transform="rotate(-10 30 18)" />
      </g>

      {/* Arms */}
      <rect x="10" y="44" width="12" height="7" rx="3.5" fill="#1d4ed8" />
      <rect x="58" y="44" width="12" height="7" rx="3.5" fill="#1d4ed8" />
      {/* Arm highlights */}
      <rect x="11" y="45" width="7" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      <rect x="59" y="45" width="7" height="2" rx="1" fill="rgba(255,255,255,0.2)" />

      {/* Floating data particles */}
      <g style={{ animation: 'particle1 3s ease-in-out infinite' }}>
        <circle cx="72" cy="25" r="2.5" fill="#00d4ff" opacity="0.7" />
      </g>
      <g style={{ animation: 'particle2 4s ease-in-out infinite 1s' }}>
        <circle cx="8" cy="30" r="2" fill="#a855f7" opacity="0.6" />
      </g>
    </svg>
  );
}

function GraphMascot() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
      <defs>
        <radialGradient id="graphFace3D" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <radialGradient id="graphSheen" cx="30%" cy="25%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="graphDepth">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="rgba(124,58,237,0.4)" />
        </filter>
      </defs>

      <g style={{ animation: 'iconFloat 3s ease-in-out infinite' }} filter="url(#graphDepth)">
        {/* Face sphere with 3D gradient */}
        <circle cx="40" cy="32" r="20" fill="url(#graphFace3D)" />
        <circle cx="40" cy="32" r="20" fill="url(#graphSheen)" />

        {/* Eye whites */}
        <circle cx="33" cy="29" r="5.5" fill="#fff" />
        <circle cx="47" cy="29" r="5.5" fill="#fff" />
        {/* Pupils with 3D depth */}
        <circle cx="34" cy="29" r="3" fill="#4c1d95" />
        <circle cx="48" cy="29" r="3" fill="#4c1d95" />
        {/* Iris sparkle */}
        <circle cx="35" cy="28" r="1.2" fill="#fff" />
        <circle cx="49" cy="28" r="1.2" fill="#fff" />
        <circle cx="35.5" cy="27.5" r="0.5" fill="rgba(255,255,255,0.8)" />
        <circle cx="49.5" cy="27.5" r="0.5" fill="rgba(255,255,255,0.8)" />

        {/* Smile */}
        <path d="M30 38 Q40 48 50 38" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Cheeks */}
        <ellipse cx="24" cy="36" rx="5" ry="3.5" fill="#ff9eb5" opacity="0.5" />
        <ellipse cx="56" cy="36" rx="5" ry="3.5" fill="#ff9eb5" opacity="0.5" />

        {/* Head highlight */}
        <ellipse cx="33" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.2)" transform="rotate(-15 33 22)" />
      </g>

      {/* Chart bars with 3D effect */}
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.1s', transformOrigin: '19px 70px' }}>
        <rect x="13" y="62" width="11" height="10" rx="3" fill="#7c3aed" />
        <rect x="13" y="62" width="11" height="4" rx="3" fill="rgba(255,255,255,0.2)" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.3s', transformOrigin: '31px 70px' }}>
        <rect x="25" y="56" width="11" height="16" rx="3" fill="#a855f7" />
        <rect x="25" y="56" width="11" height="5" rx="3" fill="rgba(255,255,255,0.2)" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.5s', transformOrigin: '43px 70px' }}>
        <rect x="37" y="50" width="11" height="22" rx="3" fill="#c084fc" />
        <rect x="37" y="50" width="11" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.7s', transformOrigin: '55px 70px' }}>
        <rect x="49" y="58" width="11" height="14" rx="3" fill="#9333ea" />
        <rect x="49" y="58" width="11" height="4" rx="3" fill="rgba(255,255,255,0.2)" />
      </g>

      {/* Up arrow with 3D */}
      <g style={{ animation: 'arrowBounce 1.5s ease-in-out infinite' }}>
        <path d="M66 18 L74 28 L70 28 L70 36 L62 36 L62 28 L58 28 Z" fill="#ffd600" />
        <path d="M66 18 L74 28 L72 28 L66 21 Z" fill="rgba(255,255,255,0.3)" />
      </g>
    </svg>
  );
}

/* ─────────── LIST ICON SVGs ─────────── */

function ListIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'exam':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" style={{ animation: 'iconSpin 8s linear infinite', transformOrigin: '12px 12px' }} />
          <line x1="12" y1="12" x2="12" y2="7" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none" />
        </svg>
      );
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <rect x="3" y="11" width="18" height="10" rx="3" />
          <path d="M7 11V8a5 5 0 0 1 10 0v3" style={{ animation: 'iconFloat 2s ease-in-out infinite' }} />
          <line x1="12" y1="15" x2="12" y2="15.01" strokeWidth="3" strokeLinecap="round" />
          <circle cx="12" cy="7" r="1.5" fill="#fff" stroke="none" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    case 'target':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" />
          <line x1="18" y1="6" x2="14" y2="10" stroke="#ffd600" strokeWidth="2.5" />
          <polygon points="19,4 21,8 17,7" fill="#ffd600" stroke="none" />
        </svg>
      );
    case 'revision':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <polyline points="1 4 1 10 7 10" style={{ animation: 'iconShake 3s ease-in-out infinite', transformOrigin: '4px 7px' }} />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case 'mistake':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2.5" />
          <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="1" fill="#fff" stroke="none" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    case 'speed':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <polygon points="13 2 4 14 12 14 11 22 20 10 12 10" fill="#fff" stroke="none" opacity="0.9" style={{ animation: 'iconShake 0.5s ease-in-out infinite' }} />
        </svg>
      );
    case 'accuracy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case 'sectional':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <rect x="3" y="3" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0s', transformOrigin: '6.5px 6.5px' }} />
          <rect x="14" y="3" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0.3s', transformOrigin: '17.5px 6.5px' }} />
          <rect x="3" y="14" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0.6s', transformOrigin: '6.5px 17.5px' }} />
          <rect x="14" y="14" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0.9s', transformOrigin: '17.5px 17.5px' }} />
        </svg>
      );
    case 'pyq':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 2v4M16 2v4M4 10h16" strokeWidth="1.8" />
          <circle cx="12" cy="15" r="2" fill="#fff" stroke="none" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    case 'concept':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" style={{ animation: 'iconFloat 3s ease-in-out infinite' }} />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
          <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" opacity="0.8" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    default:
      return null;
  }
}

/* ─────────── SUBJECT ICON SVGs ─────────── */

function SubjectIcon({ title }: { title: string }) {
  if (title === 'Mathematics') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="18" y1="6" x2="14" y2="10" stroke="#ffd600" strokeWidth="2.5" />
      <polygon points="19,4 21,8 17,7" fill="#ffd600" stroke="none" />
    </svg>
  );
  if (title === 'Reasoning') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
  if (title === 'English') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <circle cx="12" cy="8" r="5" />
      <path d="M3 21v-1a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v1" />
    </svg>
  );
}

/* ─────────── MAIN PAGE ─────────── */

export default function PlayPage() {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const emailHandle = user?.email?.split('@')[0]?.trim();
  const firstFromEmail = emailHandle ? emailHandle.split(/[._-]/)[0] : '';
  const rawName = user?.name?.trim();
  const firstFromName = rawName ? rawName.split(' ')[0] : '';
  const displayName = firstFromEmail || firstFromName || 'there';

  const filteredModes = searchQuery
    ? searchModes.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchModes;

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [searchOpen]);

  const handleRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position:absolute; border-radius:50%; transform:scale(0);
      background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
      pointer-events:none; width:${size}px; height:${size}px; z-index:10;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      animation: ripple 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    `;
    card.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  };

  const handleTiltMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = (y - rect.height / 2) / 15;
    const rotateY = (rect.width / 2 - x) / 15;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.04) translateY(-8px)`;
  };

  const handleTiltLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <div className={jakarta.className} style={{ minHeight: '100vh' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #f0f4f8;
          --card-bg: rgba(255, 255, 255, 0.88);
          --card-border: rgba(0, 0, 0, 0.07);
          --text: #0d1117;
          --muted: #5c6270;
          --surface: rgba(0, 0, 0, 0.04);
          --header-bg: rgba(240, 244, 248, 0.92);
          --shadow: rgba(0, 0, 0, 0.09);
          --shadow-colored: rgba(0, 0, 0, 0.12);
        }

        .page-root {
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          height: 100vh;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }

        /* Subtle light-mode background mesh */
        .page-root::before {
          content: '';
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 15% 20%, rgba(59, 143, 255, 0.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 75%, rgba(0, 200, 100, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(168, 85, 247, 0.04) 0%, transparent 50%);
          pointer-events: none; z-index: 0;
          animation: meshShift 20s ease-in-out infinite alternate;
        }
        @keyframes meshShift {
          0% { transform: translate(0,0) scale(1); }
          50% { transform: translate(1%,-1%) scale(1.01); }
          100% { transform: translate(-1%,1%) scale(0.99); }
        }

        .app {
          max-width: 440px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        /* ══ HEADER — sticky ══ */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px;
          position: sticky; top: 0; z-index: 100;
          background: var(--header-bg);
          backdrop-filter: blur(28px) saturate(1.5);
          -webkit-backdrop-filter: blur(28px) saturate(1.5);
          border-bottom: 1px solid rgba(0,0,0,0.07);
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
          flex-shrink: 0;
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .avatar-wrap {
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(135deg, #ff3d5a 0%, #ff7c2a 50%, #ffd600 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 21px;
          box-shadow: 0 0 0 3px rgba(255,61,90,0.18), 0 6px 20px rgba(255,61,90,0.22);
          cursor: pointer; position: relative; overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
          flex-shrink: 0;
        }
        .avatar-wrap:hover {
          transform: scale(1.08) rotate(-4deg);
          box-shadow: 0 0 0 4px rgba(255,61,90,0.15), 0 10px 28px rgba(255,61,90,0.3);
        }
        .avatar-wrap::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 60%, transparent 100%);
          animation: avatarShine 4s ease-in-out infinite;
        }
        @keyframes avatarShine {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }

        .user-info h2 { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; color: var(--text); }
        .user-info span {
          font-size: 12px; color: #00a855; font-weight: 700;
          display: flex; align-items: center; gap: 4px;
        }
        .user-info span::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: #00c866; box-shadow: 0 0 6px rgba(0,200,102,0.5);
          animation: pulseDot 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }

        .header-icons { display: flex; gap: 8px; align-items: center; }
        .icon-btn {
          width: 38px; height: 38px; border-radius: 12px;
          background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.08);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: #555;
          position: relative; overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .icon-btn:hover {
          transform: translateY(-2px) scale(1.06);
          background: #fff;
          border-color: rgba(0,0,0,0.1);
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
          color: var(--text);
        }
        .icon-btn:active { transform: scale(0.94); }
        .icon-btn svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .notif-btn { position: relative; }
        .notif-btn::after {
          content: ''; position: absolute; top: 7px; right: 7px;
          width: 8px; height: 8px; border-radius: 50%;
          background: #ff3d5a; border: 2px solid var(--bg);
          animation: notifPulse 2s ease-in-out infinite;
        }
        @keyframes notifPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,61,90,0.4); }
          50% { box-shadow: 0 0 0 5px rgba(255,61,90,0); }
        }

        /* ══ SEARCH OVERLAY ══ */
        .search-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(240,244,248,0.85); backdrop-filter: blur(20px);
          display: flex; flex-direction: column;
          align-items: center; padding: 80px 20px 0;
          opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .content-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-bottom: 36px;
          -webkit-overflow-scrolling: touch;
        }
        .search-overlay.active { opacity: 1; pointer-events: all; }
        .search-box {
          width: 100%; max-width: 440px;
          background: rgba(255,255,255,0.95);
          border: 1.5px solid #3b8fff;
          border-radius: 20px;
          display: flex; align-items: center; gap: 12px;
          padding: 14px 18px;
          box-shadow: 0 8px 32px rgba(59,143,255,0.18), 0 0 0 1px rgba(59,143,255,0.08);
          animation: searchDrop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes searchDrop {
          from { transform: translateY(-20px) scale(0.96); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .search-box svg { width: 20px; height: 20px; stroke: #3b8fff; fill: none; stroke-width: 2.5; flex-shrink: 0; }
        .search-box input {
          flex: 1; background: none; border: none; outline: none;
          font-family: inherit; font-size: 16px; font-weight: 600;
          color: var(--text);
        }
        .search-box input::placeholder { color: #aaa; font-weight: 500; }
        .search-close-btn {
          background: none; border: none; color: #aaa;
          font-size: 18px; cursor: pointer; flex-shrink: 0;
          width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.2s ease;
        }
        .search-close-btn:hover { background: var(--surface); color: var(--text); }
        .search-results {
          width: 100%; max-width: 440px; margin-top: 14px;
          background: rgba(255,255,255,0.96); border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.07);
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(0,0,0,0.1);
          animation: searchDrop 0.42s cubic-bezier(0.16, 1, 0.3, 1) 0.04s both;
        }
        .search-result-item {
          padding: 13px 18px; display: flex; align-items: center; gap: 12px;
          border-bottom: 1px solid rgba(0,0,0,0.05); cursor: pointer;
          transition: all 0.2s ease;
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover { background: rgba(59,143,255,0.05); transform: translateX(3px); }
        .s-icon {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; background: var(--surface); flex-shrink: 0;
        }
        .search-result-item span { font-size: 14px; font-weight: 700; color: var(--text); }

        /* ══ HERO ══ */
        .hero {
          margin: 14px 18px 4px;
          background: linear-gradient(135deg, #00a84d 0%, #00d06e 45%, #00bfa0 100%);
          border-radius: 26px;
          padding: 26px 22px 0;
          overflow: hidden; position: relative;
          min-height: 175px; cursor: pointer;
          box-shadow:
            0 4px 0 rgba(0,0,0,0.08),
            0 8px 0 rgba(0,0,0,0.05),
            0 20px 50px rgba(0,180,100,0.28),
            inset 0 1px 0 rgba(255,255,255,0.3),
            inset 0 -2px 0 rgba(0,0,0,0.1);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
        }
        .hero:hover {
          transform: translateY(-5px) scale(1.01);
          box-shadow:
            0 8px 0 rgba(0,0,0,0.07),
            0 14px 0 rgba(0,0,0,0.04),
            0 32px 70px rgba(0,180,100,0.36),
            inset 0 1px 0 rgba(255,255,255,0.35),
            inset 0 -2px 0 rgba(0,0,0,0.1);
        }
        /* Light sweep */
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.3) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 85%, rgba(0,0,0,0.08) 0%, transparent 40%);
        }
        /* Rotating shine */
        .hero::after {
          content: '';
          position: absolute; top: -60%; left: -60%; width: 220%; height: 220%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 20%, transparent 40%);
          animation: heroRotate 10s linear infinite;
          pointer-events: none;
        }
        @keyframes heroRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hero-inner { position: relative; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; }
        .hero-text h1 {
          font-family: ${grotesk.style.fontFamily}, sans-serif;
          font-size: 26px; color: #001a09; font-weight: 900; line-height: 1.15;
          letter-spacing: -0.5px;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.1);
        }
        .hero-text p { font-size: 12.5px; color: #003d1a; font-weight: 700; margin: 5px 0 0; opacity: 0.85; }

        /* Start Now box — raised higher via margin-bottom on hero-text */
        .hero-text { padding-bottom: 26px; }
        .hero-btn {
          margin-top: 14px;
          background: #001a09; color: #00e87a;
          border: none; border-radius: 14px;
          padding: 11px 26px; font-size: 14px; font-weight: 800;
          cursor: pointer; font-family: inherit;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          letter-spacing: 0.3px;
          position: relative; overflow: hidden;
          box-shadow:
            0 3px 0 rgba(0,0,0,0.4),
            0 6px 18px rgba(0,0,0,0.25);
          display: inline-block;
        }
        .hero-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          border-radius: inherit;
        }
        .hero-btn:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 5px 0 rgba(0,0,0,0.35), 0 10px 28px rgba(0,232,122,0.35);
          color: #fff;
        }
        .hero-btn:active { transform: translateY(1px) scale(0.97); box-shadow: 0 1px 0 rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2); }

        .hero-mascot {
          width: 148px; height: 148px;
          display: flex; align-items: flex-end; justify-content: center;
          filter: drop-shadow(0 10px 28px rgba(0,0,0,0.25));
          animation: foxFloat 4s ease-in-out infinite;
          flex-shrink: 0; margin-right: -12px; margin-bottom: -12px;
        }
        @keyframes foxFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-11px) rotate(2deg); }
          75% { transform: translateY(-6px) rotate(-1.5deg); }
        }

        /* ══ SECTION HEAD ══ */
        .section-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 20px 10px;
        }
        .section-head h3 { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; }
        .see-all {
          font-size: 13px; font-weight: 700; color: #00a050;
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 4px;
          transition: all 0.2s ease;
          padding: 4px 10px; border-radius: 8px;
          font-family: inherit;
        }
        .see-all:hover { background: rgba(0,180,90,0.08); gap: 7px; }
        .see-all::after { content: '→'; }

        /* ══ FEATURED MODE CARDS (scroll row) ══ */
        .scroll-row {
          display: flex; gap: 16px;
          padding: 6px 24px 18px;
          overflow-x: auto; scroll-snap-type: x mandatory;
          scroll-padding: 0 24px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .scroll-row::-webkit-scrollbar { display: none; }

        .mode-card {
          min-width: 160px; height: 200px;
          border-radius: 22px; position: relative;
          overflow: hidden; cursor: pointer; flex-shrink: 0;
          scroll-snap-align: start;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
          box-shadow:
            0 4px 0 rgba(0,0,0,0.12),
            0 8px 0 rgba(0,0,0,0.07),
            0 16px 40px rgba(0,0,0,0.15);
        }
        .mode-card:hover {
          box-shadow:
            0 6px 0 rgba(0,0,0,0.1),
            0 12px 0 rgba(0,0,0,0.06),
            0 28px 60px rgba(0,0,0,0.22);
        }
        .card-bg {
          position: absolute; inset: 0;
          transition: transform 0.5s ease;
        }
        /* 3D sheen overlay on cards */
        .mode-card::before {
          content: '';
          position: absolute; inset: 0; z-index: 3;
          background: linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 50%);
          border-radius: inherit;
          pointer-events: none;
        }
        .mode-card:hover .card-bg { transform: scale(1.08); }
        .card-content {
          position: absolute; inset: 0; padding: 16px 14px;
          display: flex; flex-direction: column; justify-content: space-between;
          background: linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.72) 100%);
          z-index: 2;
        }
        .card-badge {
          background: rgba(0,0,0,0.35); backdrop-filter: blur(12px);
          border-radius: 24px; padding: 4px 11px; font-size: 11px;
          font-weight: 800; display: inline-flex; align-items: center; gap: 5px;
          width: fit-content; border: 1px solid rgba(255,255,255,0.15);
          color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .card-mascot {
          position: absolute; right: -6px; bottom: 42px;
          width: 88px; height: 88px;
          display: flex; align-items: center; justify-content: center;
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.45));
          z-index: 1;
        }
        .card-bottom h4 { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: -0.2px; }
        .card-bottom p { font-size: 11px; color: rgba(255,255,255,0.72); font-weight: 600; }

        .theme-green .card-bg { background: linear-gradient(135deg, #006d3f 0%, #00b84d 50%, #00e87a 100%); }
        .theme-green:hover { box-shadow: 0 6px 0 rgba(0,0,0,0.1), 0 12px 0 rgba(0,0,0,0.06), 0 28px 60px rgba(0,232,122,0.28); }
        .theme-blue .card-bg { background: linear-gradient(135deg, #0f4db8 0%, #2563eb 50%, #3b8fff 100%); }
        .theme-blue:hover { box-shadow: 0 6px 0 rgba(0,0,0,0.1), 0 12px 0 rgba(0,0,0,0.06), 0 28px 60px rgba(59,143,255,0.28); }
        .theme-purple .card-bg { background: linear-gradient(135deg, #5b1fa8 0%, #7c3aed 50%, #a855f7 100%); }
        .theme-purple:hover { box-shadow: 0 6px 0 rgba(0,0,0,0.1), 0 12px 0 rgba(0,0,0,0.06), 0 28px 60px rgba(168,85,247,0.28); }

        /* ══ LIST CARDS ══ */
        .list-card {
          display: flex; align-items: center; gap: 16px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 20px; padding: 15px 17px; margin: 0 18px 11px;
          cursor: pointer;
          transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative; overflow: hidden;
          backdrop-filter: blur(16px);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.8),
            0 4px 16px rgba(0,0,0,0.07);
          opacity: 0;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .list-card::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 3px 0 0 3px;
          background: var(--accent-clr, #00e87a);
          opacity: 0; transition: opacity 0.25s ease;
        }
        .list-card:hover {
          transform: translateY(-3px) translateX(5px) scale(1.01);
          box-shadow: 0 2px 0 rgba(255,255,255,0.9), 0 14px 40px rgba(0,0,0,0.12);
          background: rgba(255,255,255,0.98);
        }
        .list-card:hover::before { opacity: 1; }
        .list-card:active { transform: scale(0.98); }

        .list-icon {
          width: 54px; height: 54px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; position: relative; overflow: hidden;
          box-shadow:
            0 3px 0 rgba(0,0,0,0.2),
            0 8px 20px rgba(0,0,0,0.2);
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        /* Sheen on list icons */
        .list-icon::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 55%);
          border-radius: inherit;
        }
        .list-card:hover .list-icon { transform: scale(1.1) rotate(-5deg); }

        .list-info { flex: 1; min-width: 0; }
        .list-info h4 { font-size: 14.5px; font-weight: 800; letter-spacing: -0.2px; }
        .list-info p { font-size: 12px; color: var(--muted); font-weight: 600; margin-top: 3px; }

        .list-action {
          width: 36px; height: 36px; border-radius: 50%;
          border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
          box-shadow: 0 3px 0 rgba(0,0,0,0.25), 0 5px 14px rgba(0,0,0,0.2);
          position: relative; overflow: hidden;
        }
        .list-action::after {
          content: '';
          position: absolute; inset: 0; border-radius: 50%;
          background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 55%);
        }
        .list-action:hover { transform: scale(1.2); }
        .list-action:active { transform: scale(0.92); }
        .list-action svg { width: 13px; height: 13px; fill: #000; }

        /* ══ SUBJECT CARDS ══ */
        .subject-grid { display: grid; gap: 0; }
        .subject-card {
          display: flex; align-items: center; gap: 14px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 20px; padding: 15px 17px; margin: 0 18px 11px;
          cursor: pointer;
          position: relative; overflow: hidden;
          box-shadow: 0 2px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,0,0,0.07);
          transition: all 0.3s ease;
        }
        .subject-card::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 3px 0 0 3px;
          background: var(--accent-clr, #00e87a);
        }
        .subject-card:hover {
          transform: translateY(-2px) translateX(4px);
          box-shadow: 0 2px 0 rgba(255,255,255,0.9), 0 12px 32px rgba(0,0,0,0.1);
          background: rgba(255,255,255,0.98);
        }
        .subject-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: var(--surface);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: var(--text);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.06);
        }
        .subject-info { flex: 1; min-width: 0; }
        .subject-info h3 { font-size: 14.5px; font-weight: 800; letter-spacing: -0.2px; }
        .subject-info p { font-size: 12px; color: var(--muted); font-weight: 600; margin-top: 3px; }
        .subject-arrow {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--accent-clr, #00e87a);
          flex-shrink: 0;
          box-shadow: 0 3px 0 rgba(0,0,0,0.2), 0 6px 14px rgba(0,0,0,0.18);
          position: relative; overflow: hidden;
        }
        .subject-arrow::after {
          content: '';
          position: absolute; inset: 0; border-radius: 50%;
          background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 55%);
        }
        .subject-arrow svg { width: 15px; height: 15px; stroke: #000; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

        /* ══ ANIMATIONS ══ */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ripple { to { transform: scale(3); opacity: 0; } }
        @keyframes clockSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes clockPulse { 0%,100% { opacity:0.35; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.04); } }
        @keyframes clockGlow {
          0%,100% { filter: drop-shadow(0 0 2px rgba(255,61,90,0.5)); }
          50% { filter: drop-shadow(0 0 8px rgba(255,61,90,0.85)); }
        }
        @keyframes clockShadow { 0%,100% { transform: scaleX(1); opacity:0.12; } 50% { transform: scaleX(0.85); opacity:0.08; } }
        @keyframes robotFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes robotShadow { 0%,100% { transform: scaleX(1); opacity:0.2; } 50% { transform: scaleX(0.8); opacity:0.12; } }
        @keyframes scanBeam { 0% { transform: translateX(-9px); opacity:0; } 20% { opacity:1; } 80% { opacity:1; } 100% { transform: translateX(9px); opacity:0; } }
        @keyframes eyeFlicker { 0%,85%,100% { opacity:0.95; } 88% { opacity:0.2; } 91% { opacity:0.95; } 94% { opacity:0.4; } 97% { opacity:0.95; } }
        @keyframes antennaPulse { 0%,100% { fill:#00d4ff; filter:drop-shadow(0 0 2px #00d4ff); } 50% { fill:#fff; filter:drop-shadow(0 0 7px #00d4ff); } }
        @keyframes barRise { 0%,100% { transform:scaleY(1); } 50% { transform:scaleY(1.18); } }
        @keyframes arrowBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
        @keyframes iconFloat { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-3px) rotate(3deg); } }
        @keyframes iconPulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.1); opacity:0.8; } }
        @keyframes iconSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes iconShake { 0%,100% { transform:rotate(0deg); } 25% { transform:rotate(-8deg); } 75% { transform:rotate(8deg); } }
        @keyframes foxTail { 0%,100% { transform:rotate(-10deg) translateX(0); } 50% { transform:rotate(20deg) translateX(6px); } }
        @keyframes foxEarLeft { 0%,90%,100% { transform:rotate(0deg); } 93% { transform:rotate(-13deg); } 96% { transform:rotate(6deg); } }
        @keyframes foxEarRight { 0%,90%,100% { transform:rotate(0deg); } 93% { transform:rotate(13deg); } 96% { transform:rotate(-6deg); } }
        @keyframes foxBlink { 0%,92%,100% { transform:scaleY(1); } 96% { transform:scaleY(0.08); } }
        @keyframes foxBreathe { 0%,100% { transform:scale(1); } 50% { transform:scale(1.025); } }
        @keyframes foxShadowPulse { 0%,100% { rx:36; opacity:0.18; } 50% { rx:32; opacity:0.11; } }
        @keyframes sparkle1 { 0%,100% { transform:translateY(0) scale(1); opacity:0.8; } 50% { transform:translateY(-8px) scale(1.2) rotate(30deg); opacity:1; } }
        @keyframes sparkle2 { 0%,100% { transform:translateY(0) scale(1); opacity:0.7; } 50% { transform:translateY(-6px) scale(1.15) rotate(-20deg); opacity:1; } }
        @keyframes particle1 { 0%,100% { transform:translate(0,0) scale(1); opacity:0.7; } 50% { transform:translate(-6px,-10px) scale(1.3); opacity:1; } }
        @keyframes particle2 { 0%,100% { transform:translate(0,0); opacity:0.6; } 50% { transform:translate(5px,-8px); opacity:1; } }
      `}</style>

      <div className="page-root">
        <div className="app">

          {/* ── HEADER (sticky) ── */}
          <header className="header">
            <div className="header-left">
              <div className="avatar-wrap">🎓</div>
              <div className="user-info">
                <h2>Hello, {displayName}!</h2>
                <span>Level 4</span>
              </div>
            </div>
            <div className="header-icons">
              <button
                className="icon-btn"
                title="Search"
                onClick={() => { setSearchOpen(true); setSearchQuery(''); }}
              >
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </button>
              <button className="icon-btn notif-btn" title="Notifications">
                <svg viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
            </div>
          </header>

          {/* ── SEARCH OVERLAY ── */}
          <div
            className={`search-overlay${searchOpen ? ' active' : ''}`}
            onClick={(e) => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQuery(''); } }}
          >
            <div className="search-box">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search quiz modes…"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-close-btn" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
            </div>
            <div className="search-results">
              {filteredModes.length > 0
                ? filteredModes.map((m) => (
                    <div key={m.name} className="search-result-item">
                      <div className="s-icon">{m.icon}</div>
                      <span>{m.name}</span>
                    </div>
                  ))
                : <div className="search-result-item"><div className="s-icon">🔍</div><span>No results found</span></div>
              }
            </div>
          </div>

          <div className="content-scroll">
            {/* ── HERO ── */}
            <div className="hero">
              <div className="hero-inner">
                <div className="hero-text">
                  <h1>Study Smart.<br />Rank Higher.</h1>
                  <p>10 Pro modes for SSC · CAT · UPSC</p>
                  <button className="hero-btn" onClick={() => alert('🚀 Launching Exam Simulation Mode...')}>
                    Start Now →
                  </button>
                </div>
                <div className="hero-mascot">
                  <FoxMascot />
                </div>
              </div>
            </div>

            {/* ── FEATURED MODES ── */}
            <div className="section-head">
              <h3>Featured Modes</h3>
              <button className="see-all">See All</button>
            </div>

            <div className="scroll-row">
              {featuredModes.map((mode, i) => (
                <div
                  key={mode.title}
                  className={`mode-card theme-${mode.theme}`}
                  style={{ animationDelay: `${0.05 + i * 0.05}s` }}
                  onMouseMove={handleTiltMove}
                  onMouseLeave={handleTiltLeave}
                >
                  <div className="card-bg" />
                  <div className="card-mascot">
                    {mode.mascot === 'clock' && <ClockMascot />}
                    {mode.mascot === 'robot' && <RobotMascot />}
                    {mode.mascot === 'graph' && <GraphMascot />}
                  </div>
                  <div className="card-content">
                    <div className="card-badge">{mode.badge}</div>
                    <div className="card-bottom">
                      <h4>{mode.title}</h4>
                      <p>{mode.copy}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── ALL 10 MODES ── */}
            <div className="section-head">
              <h3>All Quiz Modes</h3>
              <button className="see-all see-all-blue" style={{ color: '#2d7ef7' }}>Filter</button>
            </div>

            {allModes.map((mode, i) => (
              <div
                key={mode.title}
                className="list-card"
                style={{ '--accent-clr': mode.accent, animationDelay: `${0.05 + i * 0.03}s` } as React.CSSProperties}
                onClick={handleRipple}
              >
                <div className="list-icon" style={{ background: mode.gradient }}>
                  <ListIcon icon={mode.icon} />
                </div>
                <div className="list-info">
                  <h4>{mode.title}</h4>
                  <p>{mode.copy}</p>
                </div>
                <button
                  className="list-action"
                  style={{ background: mode.accent }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19" /></svg>
                </button>
              </div>
            ))}

            {/* ── QUICK START ── */}
            <div className="section-head">
              <h3>Quick Start</h3>
              <button className="see-all">Jump In</button>
            </div>

            <div className="subject-grid">
              {subjectCards.map((subject) => (
                <div
                  key={subject.title}
                  className="subject-card"
                  style={{ '--accent-clr': subject.accent } as React.CSSProperties}
                >
                  <div className="subject-icon">
                    <SubjectIcon title={subject.title} />
                  </div>
                  <div className="subject-info">
                    <h3>{subject.title}</h3>
                    <p>{subject.copy}</p>
                  </div>
                  <div className="subject-arrow">
                    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 24 }} />
          </div>
        </div>
      </div>
    </div>
  );
}