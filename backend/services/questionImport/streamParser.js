import readline from 'node:readline';

export class ImportFormatError extends Error {
  constructor(message) { super(message); this.name = 'ImportFormatError'; this.code = 'FORMAT'; }
}

// Content wins over extension: a ".json" file holding one object per line is NDJSON.
export function detectFormat(buffer) {
  const text = buffer.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (!text) throw new ImportFormatError('File is empty');
  if (text[0] === '[') return 'json';
  if (text[0] === '{') return 'ndjson';
  throw new ImportFormatError('File must be a JSON array or NDJSON (one JSON object per line)');
}

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
}

/**
 * Streams records out of a staged file. Yields `{ line, record }` or
 * `{ line, error }`. `line` is a stable 1-based row number (NDJSON line, or
 * array position for JSON) used for reporting, skip lists and idempotency keys.
 * Throws ImportFormatError for file-level failures (e.g. invalid JSON array).
 */
export async function* parseRecords(stream, format) {
  if (format === 'json') {
    let parsed;
    try { parsed = JSON.parse(await readAll(stream)); }
    catch (error) { throw new ImportFormatError(`Invalid JSON: ${error.message}`); }
    if (!Array.isArray(parsed)) throw new ImportFormatError('JSON file must contain a top-level array of questions');
    for (let i = 0; i < parsed.length; i++) yield { line: i + 1, record: parsed[i] };
    return;
  }
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let line = 0;
  for await (const raw of lines) {
    line++;
    const text = (line === 1 ? raw.replace(/^\uFEFF/, '') : raw).trim();
    if (!text) continue;
    try { yield { line, record: JSON.parse(text) }; }
    catch (error) { yield { line, error: `Invalid JSON on line ${line}: ${error.message}` }; }
  }
}
