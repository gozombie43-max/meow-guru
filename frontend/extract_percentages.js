const fs = require('fs');
const pdf = require('pdf-parse');

async function run() {
  const dataBuffer = fs.readFileSync('data/percentages_questions.pdf');
  const data = await pdf(dataBuffer);
  console.log('text length', data.text.length);
  fs.writeFileSync('data/percentages_questions_raw.txt', data.text);
  console.log('extracted');
}

run().catch((err)=>{console.error(err); process.exit(1);});
