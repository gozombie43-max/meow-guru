import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB, getMongoDB, getQuestionsCollection } from '../../../config/mongodb.js';
import { up as upImportMigration } from '../../../migrations/025-question-import-jobs.js';
import { detectFormat, ImportFormatError, parseRecords } from '../streamParser.js';
import { applyMapping, recordFingerprint, validateMappedRecord, validateRecord } from '../rowValidator.js';
import * as importService from '../questionImportService.js';
import { processQuestionImportJob } from '../questionImportWorker.js';

vi.mock('../../questions/questionMetadataService.js', () => ({
  refreshUploadedQuestionMetadata: vi.fn().mockResolvedValue(undefined),
  fetchQuestionsMeta: vi.fn(),
}));
vi.mock('../../questions/questionMetadataCache.js', () => ({
  invalidateQuestionMetadata: vi.fn().mockResolvedValue(undefined),
}));

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  const db = await connectMongoDB();
  await upImportMigration(db);
}, 120_000);

afterAll(async () => {
  await disconnectMongoDB();
  await mongo?.stop();
});

beforeEach(async () => {
  const db = getMongoDB();
  await Promise.all([
    db.collection('questions').deleteMany({}),
    db.collection('questionImportJobs').deleteMany({}),
    db.collection('questionImportIssues').deleteMany({}),
  ]);
});

const uploadBuf = (name, text) => ({ originalname: name, buffer: Buffer.from(text, 'utf8') });

describe('Bulk Topic Import pipeline', () => {
  it('parses NDJSON line-by-line without aborting on bad lines and validates JSON arrays', async () => {
    expect(detectFormat(Buffer.from('[{"q":1}]'))).toBe('json');
    expect(detectFormat(Buffer.from('{"q":1}\n'))).toBe('ndjson');
    expect(() => detectFormat(Buffer.from('   '))).toThrow(ImportFormatError);

    const rows = [];
    for await (const entry of parseRecords(Readable.from(['{"question":"Q1"}\nnot-json\n{"question":"Q2"}\n']), 'ndjson')) {
      rows.push(entry);
    }
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ line: 1, record: { question: 'Q1' } });
    expect(rows[1].line).toBe(2);
    expect(rows[1].error).toMatch(/Invalid JSON on line 2/);
    expect(rows[2]).toEqual({ line: 3, record: { question: 'Q2' } });
  });

  it('validates row shape, option resolution, study-mode and exam-mode boundaries', () => {
    expect(validateRecord({ question: '2+2?', options: ['3', '4'], answer: '4' })).toEqual([]);
    expect(validateRecord({ question: '2+2?', options: ['3', '4'], answer: '99' })).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'ANSWER_NOT_IN_OPTIONS' }),
    ]);
    expect(validateRecord({ options: ['only-one'] }).map(i => i.code)).toEqual(
      expect.arrayContaining(['MISSING_QUESTION', 'TOO_FEW_OPTIONS', 'MISSING_ANSWER']),
    );
    const mapped = applyMapping({ question: 'Vocab', options: ['a', 'b'], answer: 'a' }, { subject: 'english', topic: 'vocab', quizName: 'Study Mode' }, 'ssc');
    expect(validateMappedRecord(mapped, mapped, { subject: 'english', topic: 'vocab', quizName: 'Study Mode' }, 'ssc')).toEqual([
      expect.objectContaining({ code: 'STUDY_MODE_TARGET' }),
    ]);
  });

  it('uses English bilingual options for validation and fingerprints', () => {
    const first = {
      question: { en: 'Which hormone regulates blood sugar?', bn: 'কোন হরমোন রক্তে শর্করা নিয়ন্ত্রণ করে?' },
      options: { en: ['Insulin', 'Thyroxine', 'Adrenaline', 'Melatonin'], bn: ['ইনসুলিন', 'থাইরক্সিন', 'অ্যাড্রেনালিন', 'মেলাটোনিন'] },
      answer: 'Insulin',
    };
    const differentOptions = {
      ...first,
      options: { ...first.options, en: ['Glucagon', 'Cortisol', 'Oxytocin', 'Prolactin'] },
      answer: 'Glucagon',
    };

    expect(validateRecord(first)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'EMPTY_OPTION' }),
    ]));
    expect(recordFingerprint(first)).not.toBe(recordFingerprint(differentOptions));
  });

  it('stages up to 10 files, validates batch duplicates/DB collisions, streams CSV reports, and imports idempotently after confirmation', async () => {
    await getQuestionsCollection().insertOne({
      id: 'existing_1',
      question: 'Already in DB?',
      options: ['Yes', 'No'],
      answer: 'Yes',
      subject: 'mathematics',
      topic: 'percentage',
    });

    const job = await importService.createJob({ examMode: 'ssc', createdBy: 'admin_1' });
    const ndjson = [
      JSON.stringify({ question: 'What is 10% of 200?', options: ['10', '20', '30', '40'], answer: '20' }),
      JSON.stringify({ question: 'What is 10% of 200?', options: ['10', '20', '30', '40'], answer: '20' }), // in-file dup
      JSON.stringify({ question: 'Already in DB?', options: ['Yes', 'No'], answer: 'Yes' }), // DB dup
      '{broken json', // syntax error
      JSON.stringify({ question: 'Missing answer row', options: ['A', 'B'] }), // schema error
    ].join('\n');
    const jsonArr = JSON.stringify([
      { question: 'Ratio of 2 to 4?', options: ['1:2', '2:1'], answer: 'A' },
      { question: 'What is 10% of 200?', options: ['10', '20', '30', '40'], answer: '20' }, // cross-file dup
    ]);

    const { job: withFiles, warnings } = await importService.addFiles(
      job._id,
      'admin_1',
      [uploadBuf('percentage.ndjson', ndjson), uploadBuf('ratio.json', jsonArr), uploadBuf('extra.json', jsonArr)],
      [
        { subject: 'mathematics', topic: 'percentage', quizName: 'Quiz 1' },
        { subject: 'mathematics', topic: 'ratio', quizName: 'Quiz 2' },
        { subject: 'mathematics', topic: 'ratio', quizName: 'Quiz 3' },
      ],
    );
    expect(warnings.some(w => w.includes('identical content'))).toBe(true);
    expect(withFiles.files).toHaveLength(3);

    const afterRemove = await importService.removeFile(job._id, 'admin_1', withFiles.files[2].id);
    expect(afterRemove.files).toHaveLength(2);

    const preview = await importService.previewFile(job._id, 'admin_1', afterRemove.files[0].id, 3);
    expect(preview.rows).toHaveLength(3);

    // Import before validation must fail
    await expect(importService.startImport(job._id, 'admin_1', { confirm: true, fingerprint: 'nope' })).rejects.toMatchObject({ statusCode: 409 });

    await importService.startValidation(job._id, 'admin_1');
    const valResult = await processQuestionImportJob();
    expect(valResult).toEqual({ id: job._id, status: 'validated' });

    const validated = await importService.getJob(job._id, 'admin_1');
    expect(validated.status).toBe('validated');
    expect(validated.files[0].counts).toMatchObject({ total: 5, valid: 1, invalid: 2, duplicate: 2 });
    expect(validated.files[0].status).toBe('needs_review');
    expect(validated.files[1].counts).toMatchObject({ total: 2, valid: 1, invalid: 0, duplicate: 1 });

    // Stream CSV error report
    let csv = '';
    const mockRes = { setHeader: vi.fn(), write: chunk => { csv += chunk; }, end: vi.fn() };
    await importService.writeIssueReport(job._id, 'admin_1', validated.files[0].id, mockRes);
    expect(csv).toContain('INVALID_JSON');
    expect(csv).toContain('DB_DUPLICATE');

    // Require explicit confirmation
    await expect(importService.startImport(job._id, 'admin_1', { confirm: false, fingerprint: validated.fingerprint })).rejects.toMatchObject({ statusCode: 400 });

    await importService.startImport(job._id, 'admin_1', { confirm: true, fingerprint: validated.fingerprint });
    const impResult = await processQuestionImportJob();
    expect(impResult).toEqual({ id: job._id, status: 'completed' });

    const completed = await importService.getJob(job._id, 'admin_1');
    expect(completed.files[0].counts.imported).toBe(1);
    expect(completed.files[1].counts.imported).toBe(1);
    expect(await getQuestionsCollection().countDocuments({})).toBe(3); // 1 pre-existing + 2 newly imported

    // Simulate crash-resume replay from checkpoint 0 with same job/file IDs -> idempotent upsert writes 0 duplicates
    await getMongoDB().collection('questionImportJobs').updateOne(
      { _id: job._id },
      { $set: { status: 'importing', phase: 'import', lease: null, 'files.0.status': 'queued_import', 'files.0.checkpoint.nextRow': 0 } },
    );
    await processQuestionImportJob();
    expect(await getQuestionsCollection().countDocuments({})).toBe(3);
  });
});
