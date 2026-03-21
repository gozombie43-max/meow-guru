/**
 * SSC-Style Question Generator
 *
 * Generates questions from concept templates with tricky distractor options.
 * Each concept defines question patterns, value ranges, a solver, and trap generators.
 */

// ─── Trap generators ───
// These produce wrong answers that look plausible (common SSC exam traps).

function signError(correct) {
  return typeof correct === 'number' ? -correct : correct;
}

function offByOne(correct) {
  return typeof correct === 'number' ? correct + (Math.random() < 0.5 ? 1 : -1) : correct;
}

function halfCalc(correct, partial) {
  return partial !== undefined ? partial : (typeof correct === 'number' ? Math.round(correct / 2) : correct);
}

function digitSwap(correct) {
  if (typeof correct !== 'number' || correct < 10) return correct + 10;
  const s = String(Math.abs(correct));
  if (s.length < 2) return correct + 10;
  const swapped = s[1] + s[0] + s.slice(2);
  const result = parseInt(swapped, 10) * (correct < 0 ? -1 : 1);
  return result === correct ? correct + 11 : result;
}

function nearby(correct, spread) {
  const offset = Math.floor(Math.random() * (spread || 5)) + 1;
  return typeof correct === 'number' ? correct + (Math.random() < 0.5 ? offset : -offset) : correct;
}

// ─── Utility ───

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueOptions(correct, traps, count = 4) {
  const set = new Set();
  set.add(String(correct));
  for (const t of traps) {
    if (set.size >= count) break;
    const s = String(t);
    if (s !== String(correct)) set.add(s);
  }
  // fill remaining with nearby values
  let attempts = 0;
  while (set.size < count && attempts < 50) {
    const filler = typeof correct === 'number'
      ? correct + randInt(-10, 10)
      : correct;
    if (String(filler) !== String(correct)) set.add(String(filler));
    attempts++;
  }
  return shuffle([...set]).slice(0, count);
}

// ─── Concept Templates ───
// Each template: { concept, subject, chapter, formulas[], difficulties{easy,medium,hard} }
// Each difficulty: generate() → { question, correct, partial?, traps[], trapType, formula }

const TEMPLATES = [

  // ── MATHEMATICS ──

  {
    concept: 'Linear Equations',
    subject: 'Mathematics',
    chapter: 'Algebra',
    difficulties: {
      easy: () => {
        const a = randInt(2, 5), b = randInt(1, 9), x = randInt(1, 15);
        const rhs = a * x + b;
        return {
          question: `If ${a}x + ${b} = ${rhs}, find the value of x.`,
          correct: x,
          partial: rhs - b,
          traps: [signError(x), offByOne(x), halfCalc(x, a * x), nearby(x, 3)],
          trapType: 'Sign Error',
          formula: 'x = (c - b) / a'
        };
      },
      medium: () => {
        const a = randInt(2, 7), b = randInt(1, 12), c = randInt(1, 5), d = randInt(1, 20);
        const x = d + b - (c ? c : 0); // not always integer — keep simple
        const lhs = a;
        const rhs_val = lhs * 3 + b;
        const ans = 3;
        const actual_a = randInt(3, 8), actual_b = randInt(2, 10), actual_ans = randInt(2, 12);
        const actual_rhs = actual_a * actual_ans - actual_b;
        return {
          question: `Solve: ${actual_a}x − ${actual_b} = ${actual_rhs}`,
          correct: actual_ans,
          partial: actual_rhs + actual_b,
          traps: [actual_ans + 1, actual_ans - 1, Math.round((actual_rhs + actual_b) / 2), signError(actual_ans)],
          trapType: 'Partial Calculation',
          formula: 'x = (c + b) / a'
        };
      },
      hard: () => {
        const a = randInt(3, 9), b = randInt(2, 8), c = randInt(2, 6), d = randInt(1, 10);
        const x = randInt(2, 10);
        const lhs = a * x + b;
        const rhs = c * x + d;
        const diff = lhs - rhs;
        return {
          question: `If ${a}x + ${b} = ${c}x + ${d + (a - c) * x}, what is x?`,
          correct: x,
          traps: [x + 2, x - 1, digitSwap(x), Math.abs(b - d)],
          trapType: 'Misread Question',
          formula: '(a-c)x = d-b'
        };
      }
    }
  },

  {
    concept: 'Percentage',
    subject: 'Mathematics',
    chapter: 'Arithmetic',
    difficulties: {
      easy: () => {
        const p = pick([5, 10, 15, 20, 25, 30]), n = pick([100, 200, 300, 400, 500]);
        const ans = (p / 100) * n;
        return {
          question: `What is ${p}% of ${n}?`,
          correct: ans,
          traps: [p * n, ans + n / 100, ans / 2, nearby(ans, 5)],
          trapType: 'Unit Confusion',
          formula: '(P/100) × N'
        };
      },
      medium: () => {
        const original = pick([200, 250, 400, 500, 800]);
        const pct = pick([10, 15, 20, 25]);
        const increased = original + (pct / 100) * original;
        return {
          question: `A number is increased by ${pct}% to become ${increased}. What is the original number?`,
          correct: original,
          partial: increased - pct,
          traps: [increased - pct, Math.round(increased / pct * 10), original + pct, nearby(original, 20)],
          trapType: 'Partial Calculation',
          formula: 'Original = New / (1 + P/100)'
        };
      },
      hard: () => {
        const cp = randInt(100, 500) * 10;
        const profitPct = pick([10, 15, 20, 25, 30]);
        const sp = Math.round(cp * (1 + profitPct / 100));
        return {
          question: `An article bought for ₹${cp} is sold at ${profitPct}% profit. What is the selling price?`,
          correct: sp,
          traps: [cp + profitPct, Math.round(cp - (profitPct / 100) * cp), sp + Math.round(cp * 0.01), nearby(sp, 50)],
          trapType: 'Sign Error',
          formula: 'SP = CP × (1 + P/100)'
        };
      }
    }
  },

  {
    concept: 'Ratio and Proportion',
    subject: 'Mathematics',
    chapter: 'Arithmetic',
    difficulties: {
      easy: () => {
        const a = randInt(2, 5), b = randInt(2, 5);
        const total = (a + b) * randInt(2, 10);
        const partA = (a / (a + b)) * total;
        return {
          question: `Divide ${total} in the ratio ${a}:${b}. What is the larger part?`,
          correct: Math.max(partA, total - partA),
          traps: [Math.min(partA, total - partA), total / 2, total / a, nearby(Math.max(partA, total - partA), 3)],
          trapType: 'Partial Calculation',
          formula: 'Part = (ratio / sum of ratios) × total'
        };
      },
      medium: () => {
        const a = randInt(2, 6), b = randInt(2, 6), c = randInt(2, 6);
        const total = (a + b + c) * randInt(5, 15);
        const partA = Math.round((a / (a + b + c)) * total);
        return {
          question: `₹${total} is divided among A, B, C in the ratio ${a}:${b}:${c}. How much does A get?`,
          correct: partA,
          traps: [Math.round(total / 3), Math.round((b / (a + b + c)) * total), partA + a, nearby(partA, 10)],
          trapType: 'Misread Question',
          formula: 'Share = (own ratio / total ratio) × Amount'
        };
      },
      hard: () => {
        const a = randInt(3, 7), b = randInt(3, 7);
        const k = randInt(2, 5);
        const diff = Math.abs(a - b) * k;
        const total = (a + b) * k;
        return {
          question: `Two numbers are in the ratio ${a}:${b} and their difference is ${diff}. Find their sum.`,
          correct: total,
          traps: [diff * 2, a * b, total + diff, nearby(total, 5)],
          trapType: 'Partial Calculation',
          formula: 'Sum = (a+b) × (difference / |a-b|)'
        };
      }
    }
  },

  {
    concept: 'Simple Interest',
    subject: 'Mathematics',
    chapter: 'Arithmetic',
    difficulties: {
      easy: () => {
        const P = pick([1000, 2000, 5000, 10000]);
        const R = pick([5, 8, 10, 12]);
        const T = pick([2, 3, 4, 5]);
        const SI = (P * R * T) / 100;
        return {
          question: `Find the simple interest on ₹${P} at ${R}% per annum for ${T} years.`,
          correct: SI,
          traps: [P * R / 100, SI + P, SI * 2, nearby(SI, 50)],
          trapType: 'Partial Calculation',
          formula: 'SI = PRT / 100'
        };
      },
      medium: () => {
        const P = pick([2000, 3000, 5000, 8000]);
        const R = pick([6, 8, 10, 12]);
        const T = pick([2, 3, 5]);
        const SI = (P * R * T) / 100;
        const A = P + SI;
        return {
          question: `₹${P} is invested at ${R}% p.a. simple interest. What is the amount after ${T} years?`,
          correct: A,
          traps: [SI, P + R * T, A - 100, nearby(A, 100)],
          trapType: 'Partial Calculation',
          formula: 'A = P + (PRT/100)'
        };
      },
      hard: () => {
        const A = pick([5600, 6720, 8400, 11200]);
        const R = pick([8, 10, 12]);
        const T = pick([3, 4, 5]);
        const P = Math.round(A / (1 + (R * T) / 100));
        return {
          question: `A sum amounts to ₹${A} in ${T} years at ${R}% p.a. simple interest. Find the principal.`,
          correct: P,
          traps: [A - R * T, Math.round(A / T), P + 100, nearby(P, 200)],
          trapType: 'Approximation Trick',
          formula: 'P = A / (1 + RT/100)'
        };
      }
    }
  },

  {
    concept: 'Time and Work',
    subject: 'Mathematics',
    chapter: 'Arithmetic',
    difficulties: {
      easy: () => {
        const a = pick([10, 12, 15, 20]);
        const b = pick([12, 15, 20, 30]);
        const together = (a * b) / (a + b);
        const ans = parseFloat(together.toFixed(2));
        return {
          question: `A can do a work in ${a} days, B in ${b} days. In how many days can they finish it together?`,
          correct: ans,
          traps: [(a + b) / 2, Math.min(a, b), a + b, nearby(ans, 2)],
          trapType: 'Approximation Trick',
          formula: '1/A + 1/B = 1/T → T = AB/(A+B)'
        };
      },
      medium: () => {
        const a = pick([10, 12, 15]);
        const b = pick([15, 20, 30]);
        const daysTogether = 4;
        const workDone = daysTogether * (1/a + 1/b);
        const remaining = parseFloat((1 - workDone).toFixed(4));
        const bAlone = parseFloat((remaining * b).toFixed(2));
        return {
          question: `A can do a work in ${a} days, B in ${b} days. They work together for ${daysTogether} days, then A leaves. How many more days for B to finish?`,
          correct: bAlone,
          traps: [b - daysTogether, Math.round(remaining * a), bAlone + 1, nearby(bAlone, 2)],
          trapType: 'Partial Calculation',
          formula: 'Remaining = 1 − days×(1/A+1/B); B alone = remaining × B'
        };
      },
      hard: () => {
        const a = 12, b = 15, c = 20;
        const together = (1/a + 1/b + 1/c);
        const days = parseFloat((1 / together).toFixed(2));
        return {
          question: `A, B, C can do a work in ${a}, ${b}, ${c} days respectively. How many days if they work together?`,
          correct: days,
          traps: [Math.round((a + b + c) / 3), Math.min(a, b, c), days + 2, nearby(days, 1)],
          trapType: 'Approximation Trick',
          formula: '1/A + 1/B + 1/C = 1/T'
        };
      }
    }
  },

  {
    concept: 'Speed, Time and Distance',
    subject: 'Mathematics',
    chapter: 'Arithmetic',
    difficulties: {
      easy: () => {
        const speed = pick([40, 50, 60, 80]);
        const time = pick([2, 3, 4, 5]);
        const dist = speed * time;
        return {
          question: `A car travels at ${speed} km/h for ${time} hours. What distance does it cover?`,
          correct: dist,
          traps: [speed + time, dist / 2, speed * (time + 1), nearby(dist, 20)],
          trapType: 'Unit Confusion',
          formula: 'Distance = Speed × Time'
        };
      },
      medium: () => {
        const d = pick([120, 150, 200, 240, 300]);
        const s1 = pick([40, 50, 60]);
        const s2 = s1 + pick([10, 20, 30]);
        const avgSpeed = parseFloat(((2 * s1 * s2) / (s1 + s2)).toFixed(2));
        return {
          question: `A person goes from A to B at ${s1} km/h and returns at ${s2} km/h. What is the average speed for the round trip?`,
          correct: avgSpeed,
          traps: [(s1 + s2) / 2, s1, s2, nearby(avgSpeed, 5)],
          trapType: 'Approximation Trick',
          formula: 'Avg speed = 2S₁S₂ / (S₁+S₂)'
        };
      },
      hard: () => {
        const speed = pick([60, 72, 90, 108]);
        const msSpeed = parseFloat((speed * (5 / 18)).toFixed(2));
        return {
          question: `Convert ${speed} km/h to m/s.`,
          correct: msSpeed,
          traps: [speed / 5, speed * 18 / 5, Math.round(speed / 3), nearby(msSpeed, 3)],
          trapType: 'Unit Confusion',
          formula: 'km/h × 5/18 = m/s'
        };
      }
    }
  },

  // ── REASONING ──

  {
    concept: 'Number Series',
    subject: 'Reasoning',
    chapter: 'Series',
    difficulties: {
      easy: () => {
        const start = randInt(1, 5);
        const step = randInt(2, 6);
        const series = Array.from({ length: 5 }, (_, i) => start + step * i);
        const ans = start + step * 5;
        return {
          question: `Find the next number: ${series.join(', ')}, ?`,
          correct: ans,
          traps: [ans + step, ans - 1, series[4] + series[3], nearby(ans, 3)],
          trapType: 'Partial Calculation',
          formula: 'Arithmetic progression: a + (n)d'
        };
      },
      medium: () => {
        const series = [2, 6, 12, 20, 30];
        const ans = 42;
        return {
          question: `Find the next number: ${series.join(', ')}, ?`,
          correct: ans,
          traps: [40, 36, 44, 38],
          trapType: 'Partial Calculation',
          formula: 'n(n+1) pattern'
        };
      },
      hard: () => {
        const series = [1, 1, 2, 3, 5, 8];
        const ans = 13;
        return {
          question: `Find the next number: ${series.join(', ')}, ?`,
          correct: ans,
          traps: [11, 14, 12, 16],
          trapType: 'Misread Question',
          formula: 'Fibonacci: each = sum of previous two'
        };
      }
    }
  },

  // ── ENGLISH ──

  {
    concept: 'Synonyms',
    subject: 'English',
    chapter: 'Vocabulary',
    difficulties: {
      easy: () => {
        const pair = pick([
          { word: 'Happy', correct: 'Joyful', traps: ['Sad', 'Angry', 'Tired'] },
          { word: 'Big', correct: 'Large', traps: ['Small', 'Tiny', 'Narrow'] },
          { word: 'Fast', correct: 'Quick', traps: ['Slow', 'Lazy', 'Heavy'] },
          { word: 'Brave', correct: 'Courageous', traps: ['Cowardly', 'Timid', 'Fearful'] },
          { word: 'Begin', correct: 'Start', traps: ['End', 'Stop', 'Finish'] },
        ]);
        return {
          question: `Choose the synonym of '${pair.word}':`,
          correct: pair.correct,
          traps: pair.traps,
          trapType: 'Misread Question',
          formula: ''
        };
      },
      medium: () => {
        const pair = pick([
          { word: 'Benevolent', correct: 'Kind', traps: ['Cruel', 'Hostile', 'Indifferent'] },
          { word: 'Arduous', correct: 'Difficult', traps: ['Simple', 'Elegant', 'Passionate'] },
          { word: 'Eloquent', correct: 'Articulate', traps: ['Silent', 'Rude', 'Verbose'] },
          { word: 'Pragmatic', correct: 'Practical', traps: ['Idealistic', 'Dramatic', 'Chaotic'] },
          { word: 'Diligent', correct: 'Industrious', traps: ['Lazy', 'Negligent', 'Careless'] },
        ]);
        return {
          question: `Choose the synonym of '${pair.word}':`,
          correct: pair.correct,
          traps: pair.traps,
          trapType: 'Misread Question',
          formula: ''
        };
      },
      hard: () => {
        const pair = pick([
          { word: 'Ephemeral', correct: 'Transient', traps: ['Permanent', 'Eternal', 'Tangible'] },
          { word: 'Ubiquitous', correct: 'Omnipresent', traps: ['Rare', 'Hidden', 'Unique'] },
          { word: 'Sycophant', correct: 'Flatterer', traps: ['Critic', 'Leader', 'Rebel'] },
          { word: 'Recalcitrant', correct: 'Defiant', traps: ['Obedient', 'Submissive', 'Calm'] },
          { word: 'Perfunctory', correct: 'Cursory', traps: ['Thorough', 'Perfect', 'Diligent'] },
        ]);
        return {
          question: `Choose the synonym of '${pair.word}':`,
          correct: pair.correct,
          traps: pair.traps,
          trapType: 'Misread Question',
          formula: ''
        };
      }
    }
  },

  {
    concept: 'Antonyms',
    subject: 'English',
    chapter: 'Vocabulary',
    difficulties: {
      easy: () => {
        const pair = pick([
          { word: 'Hot', correct: 'Cold', traps: ['Warm', 'Cool', 'Bright'] },
          { word: 'Dark', correct: 'Light', traps: ['Dim', 'Dull', 'Bright'] },
          { word: 'Rich', correct: 'Poor', traps: ['Wealthy', 'Famous', 'Humble'] },
          { word: 'Early', correct: 'Late', traps: ['Soon', 'Quick', 'Slow'] },
        ]);
        return {
          question: `Choose the antonym of '${pair.word}':`,
          correct: pair.correct,
          traps: pair.traps,
          trapType: 'Misread Question',
          formula: ''
        };
      },
      medium: () => {
        const pair = pick([
          { word: 'Generous', correct: 'Miserly', traps: ['Kind', 'Liberal', 'Wealthy'] },
          { word: 'Ancient', correct: 'Modern', traps: ['Old', 'Historic', 'Traditional'] },
          { word: 'Courageous', correct: 'Cowardly', traps: ['Brave', 'Bold', 'Fearless'] },
        ]);
        return {
          question: `Choose the antonym of '${pair.word}':`,
          correct: pair.correct,
          traps: pair.traps,
          trapType: 'Misread Question',
          formula: ''
        };
      },
      hard: () => {
        const pair = pick([
          { word: 'Loquacious', correct: 'Taciturn', traps: ['Talkative', 'Eloquent', 'Verbose'] },
          { word: 'Ostentatious', correct: 'Modest', traps: ['Showy', 'Extravagant', 'Flamboyant'] },
          { word: 'Prolific', correct: 'Barren', traps: ['Productive', 'Abundant', 'Fertile'] },
        ]);
        return {
          question: `Choose the antonym of '${pair.word}':`,
          correct: pair.correct,
          traps: pair.traps,
          trapType: 'Misread Question',
          formula: ''
        };
      }
    }
  },

  // ── GENERAL KNOWLEDGE ──

  {
    concept: 'Indian Polity',
    subject: 'General Knowledge',
    chapter: 'Polity',
    difficulties: {
      easy: () => {
        const q = pick([
          { question: 'How many fundamental rights are recognized by the Indian Constitution?', correct: '6', traps: ['5', '7', '8'] },
          { question: 'Who appoints the Chief Justice of India?', correct: 'President', traps: ['Prime Minister', 'Parliament', 'Governor'] },
          { question: 'The Rajya Sabha is also known as:', correct: 'Council of States', traps: ['House of People', 'Upper Parliament', 'Senate'] },
        ]);
        return { ...q, trapType: 'Misread Question', formula: '' };
      },
      medium: () => {
        const q = pick([
          { question: 'Which article of the Indian Constitution abolishes untouchability?', correct: 'Article 17', traps: ['Article 14', 'Article 19', 'Article 21'] },
          { question: 'The 73rd Amendment is related to:', correct: 'Panchayati Raj', traps: ['Fundamental Rights', 'President\'s Rule', 'GST'] },
        ]);
        return { ...q, trapType: 'Misread Question', formula: '' };
      },
      hard: () => {
        const q = pick([
          { question: 'Which schedule of the Constitution deals with the allocation of seats in the Rajya Sabha?', correct: 'Fourth Schedule', traps: ['Third Schedule', 'Fifth Schedule', 'Seventh Schedule'] },
          { question: 'The concept of "Procedure established by law" is borrowed from the constitution of:', correct: 'Japan', traps: ['USA', 'UK', 'France'] },
        ]);
        return { ...q, trapType: 'Misread Question', formula: '' };
      }
    }
  },
];

// ─── Generator ───

function getAvailableConcepts() {
  return TEMPLATES.map(t => ({
    concept: t.concept,
    subject: t.subject,
    chapter: t.chapter,
    difficulties: Object.keys(t.difficulties)
  }));
}

function generate({ concept, difficulty = 'medium', count = 5 }) {
  // Find matching templates
  let pool = TEMPLATES;
  if (concept) {
    pool = pool.filter(t => t.concept.toLowerCase() === concept.toLowerCase());
  }

  if (pool.length === 0) {
    return { error: `No template found for concept "${concept}". Use /api/generate/concepts for available concepts.` };
  }

  const results = [];

  for (let i = 0; i < count; i++) {
    const template = pick(pool);
    const diff = template.difficulties[difficulty] || template.difficulties['medium'] || Object.values(template.difficulties)[0];
    const generated = diff();

    const correct = String(generated.correct);
    const options = typeof generated.traps[0] === 'string' && isNaN(generated.traps[0])
      ? shuffle([correct, ...generated.traps.slice(0, 3)])
      : uniqueOptions(generated.correct, generated.traps);

    results.push({
      subject: template.subject,
      chapter: template.chapter,
      concept: template.concept,
      difficulty,
      formula: generated.formula || '',
      trapType: generated.trapType || '',
      question: generated.question,
      options,
      correctAnswer: correct
    });
  }

  return { count: results.length, questions: results };
}

// ─── Single Exam Question with Explanation ───

function buildExplanation(template, generated, difficulty) {
  const parts = [];
  if (generated.formula) parts.push(`Formula used: ${generated.formula}`);

  // Numeric solution walkthrough
  if (typeof generated.correct === 'number') {
    parts.push(`Correct answer: ${generated.correct}`);
    if (generated.partial !== undefined) {
      parts.push(`Common mistake: stopping at the intermediate value ${generated.partial} instead of completing the calculation.`);
    }
  } else {
    parts.push(`Correct answer: ${generated.correct}`);
  }

  if (generated.trapType) {
    parts.push(`Trap type: ${generated.trapType} — watch out for this common SSC exam trick`);
  }

  return parts.join('. ') + '.';
}

function generateExamQuestion({ concept, difficulty = 'medium', trapType } = {}) {
  let pool = TEMPLATES;

  if (concept) {
    pool = pool.filter(t => t.concept.toLowerCase() === concept.toLowerCase());
  }

  if (pool.length === 0) {
    return { error: `No template found for concept "${concept}". Use /api/generate/concepts for available concepts.` };
  }

  // If trapType is specified, prefer templates whose generated output matches
  // We try up to 20 times to find a matching trapType, else return best available
  let bestResult = null;
  const maxAttempts = trapType ? 20 : 1;

  for (let i = 0; i < maxAttempts; i++) {
    const template = pick(pool);
    const diff = template.difficulties[difficulty] || template.difficulties['medium'] || Object.values(template.difficulties)[0];
    const generated = diff();

    const correct = String(generated.correct);
    const options = typeof generated.traps[0] === 'string' && isNaN(generated.traps[0])
      ? shuffle([correct, ...generated.traps.slice(0, 3)])
      : uniqueOptions(generated.correct, generated.traps);

    const result = {
      question: generated.question,
      options,
      correctAnswer: correct,
      explanation: buildExplanation(template, generated, difficulty),
      subject: template.subject,
      chapter: template.chapter,
      concept: template.concept,
      difficulty,
      formula: generated.formula || '',
      trapType: generated.trapType || ''
    };

    if (!trapType) return result;

    // Check trap match
    if (generated.trapType && generated.trapType.toLowerCase() === trapType.toLowerCase()) {
      return result;
    }

    if (!bestResult) bestResult = result;
  }

  // No exact match found — return best available with note
  bestResult.note = `Requested trapType "${trapType}" not found for this concept/difficulty. Returned closest available.`;
  return bestResult;
}

module.exports = { generate, getAvailableConcepts, generateExamQuestion };
