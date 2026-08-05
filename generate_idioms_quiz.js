const fs = require('fs');
const p = require('path');

let wrapper = fs.readFileSync('frontend/app/english/synonyms-antonyms/study-mode/quiz/page.tsx', 'utf8');
const outWrapper = 'frontend/app/english/idioms-phrases/study-mode/quiz/page.tsx';
fs.mkdirSync(p.dirname(outWrapper), { recursive: true });
fs.writeFileSync(outWrapper, wrapper);

let engine = fs.readFileSync('frontend/app/english/synonyms-antonyms/study-mode/quiz/quiz-engine.tsx', 'utf8');
engine = engine.replace(/topic: "synonyms-antonyms"/g, 'topic: "idioms-phrases"');
engine = engine.replace(/\/english\/synonyms-antonyms\/study-mode/g, '/english/idioms-phrases/study-mode');
engine = engine.replace(/Synonyms & Antonyms/g, 'Idioms & Phrases');
engine = engine.replace(/Synonyms/g, 'Examples');
engine = engine.replace(/SYNONYMS/g, 'EXAMPLES');
engine = engine.replace(/Antonyms/g, 'Related');
engine = engine.replace(/ANTONYMS/g, 'RELATED');

const outEngine = 'frontend/app/english/idioms-phrases/study-mode/quiz/quiz-engine.tsx';
fs.mkdirSync(p.dirname(outEngine), { recursive: true });
fs.writeFileSync(outEngine, engine);

console.log("Idioms quiz generated");
