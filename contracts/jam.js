export const jamQuestionTopic = slug => `iit-jam-${slug}`;
export const JAM_SECTIONS = [
  { slug: 'mathematical-methods', title: 'Mathematical Methods', symbol: '√Σ', color: '#9580ff', topics: ['Calculus', 'Vector algebra', 'Differential equations', 'Matrices', 'Probability'] },
  { slug: 'mechanics', title: 'Mechanics and General Properties of Matter', symbol: '⚖', color: '#ff9567', topics: ['Newtonian mechanics', 'Conservation laws', 'Rotational motion', 'Gravitation', 'Elasticity and fluids'] },
  { slug: 'oscillations-waves-optics', title: 'Oscillations, Waves and Optics', symbol: '∿', color: '#db7deb', topics: ['Simple harmonic motion', 'Wave motion', 'Interference', 'Diffraction', 'Polarization'] },
  { slug: 'electricity-magnetism', title: 'Electricity and Magnetism', symbol: '⊕', color: '#4baeff', topics: ['Electrostatics', 'Current electricity', 'Magnetic fields', 'Electromagnetic induction', 'Maxwell equations'] },
  { slug: 'thermodynamics', title: 'Kinetic Theory, Thermodynamics', symbol: '♨', color: '#f5b63f', topics: ['Kinetic theory', 'Laws of thermodynamics', 'Entropy', 'Thermodynamic potentials'] },
  { slug: 'modern-physics', title: 'Modern Physics', symbol: '⚛', color: '#8c7bff', topics: ['Relativity', 'Quantum mechanics', 'Atomic physics', 'Nuclear physics'] },
  { slug: 'solid-state-electronics', title: 'Solid State Physics, Devices and Electronics', symbol: '◇', color: '#43c9e9', topics: ['Crystal structure', 'Band theory', 'Semiconductors', 'Transistors', 'Digital electronics'] },
];

const section = (key, label, questionCount, correct, incorrect, questionType) => ({ key, label, questionCount, timeLimitMin: 0, marking: { correct, incorrect }, questionType, topics: ['iit-jam-physics'] });
// https://jam2026.iitb.ac.in/Syllabus.html — MCQ, MSQ and NAT, 60 questions / 100 marks.
export const JAM_MOCK_CONFIGS = {
  'iit-jam-physics': {
    key: 'iit-jam-physics', name: 'IIT JAM Physics', compositeTimer: true, totalDurationMin: 180, requireFixedPaper: true,
    sections: [
      section('a1', 'A · MCQ · 1 mark', 10, 1, 1 / 3, 'MCQ'),
      section('a2', 'A · MCQ · 2 marks', 20, 2, 2 / 3, 'MCQ'),
      section('b', 'B · Multiple select', 10, 2, 0, 'MSQ'),
      section('c1', 'C · Numerical · 1 mark', 10, 1, 0, 'NAT'),
      section('c2', 'C · Numerical · 2 marks', 10, 2, 0, 'NAT'),
    ],
  },
  ...Object.fromEntries(JAM_SECTIONS.map(s => {
    const key = `iit-jam-physics-${s.slug}`;
    return [key, { key, name: `${s.title} · IIT JAM`, compositeTimer: true, totalDurationMin: 30, requireFixedPaper: true,
      sections: [{ ...section('physics', s.title, 20, 1, 0, 'MCQ'), topics: [jamQuestionTopic(s.slug)] }] }];
  })),
};
