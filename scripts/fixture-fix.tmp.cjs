const fs = require('node:fs');
const file = 'backend/scripts/browser-fixture.js';
fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace("difficulty: 2, expectedTime", "difficulty: 'easy', expectedTime"));
