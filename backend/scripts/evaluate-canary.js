import { readFile, writeFile } from 'node:fs/promises';
import { evaluateCanary } from '../infrastructure/canaryPolicy.js';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node evaluate-canary.js <observations.json> <decision.json>');
const result = evaluateCanary(JSON.parse(await readFile(input, 'utf8')));
await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (!result.promote) process.exitCode = 1;
