const fs = require('fs');
const path = require('path');
const inputPath = path.join('frontend','data','Geometry_questions.md');
const outputPath = path.join('frontend','data','geometry_questions.json');
const text = fs.readFileSync(inputPath,'utf8');
const start = text.indexOf('Q.1.');
if (start < 0) { throw new Error('No Q.1'); }
const body = text.slice(start);
const blocks = body.split(/(?=Q\.\d+\.)/g);
const questions = [];
for (const block of blocks) {
  const qMatch = block.match(/^Q\.(\d+)\.(.*?)(?=\n\(a\))/s);
  if (!qMatch) continue;
  const id = parseInt(qMatch[1], 10);
  let question = qMatch[2].trim().replace(/\s+/g,' ');
  question = question.replace(/SSC.*$|\(.*Shift\).*$/s,'').trim();

  const optMatches = [...block.matchAll(/\(([abcd])\)\s*([^\n]+)\n?/g)];
  if (optMatches.length === 0) continue;
  const options = optMatches.map((m)=>m[2].trim());

  const ansMatch = block.match(/✓\s*Answer:\s*\(([abcd])\)/i);
  if (!ansMatch) continue;
  const answerLetter = ansMatch[1].toLowerCase();
  const ansIndex = {a:0,b:1,c:2,d:3}[answerLetter];
  const answer = options[ansIndex] || '';

  const examMatch = block.match(/SSC[^\n]*/);
  const exam = examMatch ? examMatch[0].trim() : '';
  const yearMatch = block.match(/(20\d\d)/);
  const year = yearMatch ? yearMatch[1] : '';

  questions.push({id,question,options,answer,correctLetter:answerLetter,exam,year});
}

console.log('parsed', questions.length, 'questions');
fs.writeFileSync(outputPath, JSON.stringify(questions,null,2));
