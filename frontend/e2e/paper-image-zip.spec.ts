import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const JSZip = createRequire(resolve('../backend/package.json'))('jszip');

const backend = 'http://127.0.0.1:3111';
const frontend = process.env.PAPER_ZIP_UI_ORIGIN || 'http://127.0.0.1:3110';
const paperEndpoint = `${backend}/api/mocktest/admin/slots/browser-practice/questions?examSlug=ssc-cgl&examMode=ssc`;
let restore: { token: string; edit: Record<string, unknown> } | null = null;
test.afterEach(async ({ context, request }) => {
  await context.unrouteAll({ behavior: 'wait' });
  if (!restore) return;
  const { token, edit } = restore; restore = null;
  const headers = { Authorization: `Bearer ${token}` };
  const current = await (await request.get(paperEndpoint, { headers })).json();
  const saved = await request.patch(paperEndpoint, { headers, data: { examSlug: 'ssc-cgl', expectedUpdatedAt: current.updatedAt, edits: [edit] } });
  expect(saved.ok(), 'Restore the shared disposable paper after this test').toBeTruthy();
});

test('paper ZIP validates, uploads to storage and reloads linked question and option images', async ({ page, context, request }, info) => {
  test.setTimeout(180000);
  const login = await request.post(`${backend}/auth/login`, { data: { email: 'browser-admin@example.test', password: 'Browser-fixture-123!' } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const original = await (await request.get(paperEndpoint, { headers: { Authorization: `Bearer ${token}` } })).json();
  const { sectionKey: _section, questionType: _type, ...edit } = original.questions.find((q: { id: string }) => q.id === 'ga-0');
  restore = { token, edit };
  let uploadResponse: Promise<void> | null = null;
  await context.addCookies([{ name: 'access_session', value: 'local-admin-fixture', url: frontend }]);
  await context.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/backend-api/, '');
    if (path === '/auth/refresh') return route.fulfill({ json: { token } });
    const response = await route.fetch({ url: `${backend}${path}${url.search}` });
    if (path.endsWith('/question-images-zip') && uploadResponse) await uploadResponse;
    await route.fulfill({ response });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(theme => { localStorage.setItem('ui-theme', theme); }, info.project.name === 'mobile' ? 'dark' : 'light');
  await page.goto('/admin/mock-pyq', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const row = page.getByRole('row').filter({ hasText: 'Browser practice mock' });
  await row.getByRole('button', { name: 'Edit questions in Browser practice mock', exact: true }).click();
  await page.getByText('Bulk upload question & option images (.zip)', { exact: true }).click();
  const invalid = await new JSZip().file('unused.txt', 'bad').generateAsync({ type: 'nodebuffer' });
  await page.getByLabel('Paper image ZIP').setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: invalid });
  await page.getByRole('button', { name: 'Validate ZIP', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Missing manifest.json' })).toBeVisible();
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ version: 1, examSlug: 'ssc-cgl', paperId: 'browser-practice', images: [
    { questionId: 'ga-0', target: 'question', file: 'images/question.webp' },
    { questionId: 'ga-0', target: 'option', option: 'B', language: 'en', file: 'images/question.webp' },
  ] }));
  zip.file('images/question.webp', readFileSync(resolve('public/images/topic-thumbnails/newspaper.webp')));
  await page.getByLabel('Paper image ZIP').setInputFiles({ name: 'paper.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
  await expect(page.getByRole('button', { name: 'Upload & link images' })).toBeDisabled();
  await page.getByRole('button', { name: 'Validate ZIP', exact: true }).click();
  await expect(page.getByText('Validated: 1 file · 1 question. Review before uploading:')).toBeVisible();
  await expect(page.getByText(/option B \(en\).*(replaces existing content|Already linked)/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('zip-review.png'), fullPage: true });
  let releaseUpload!: () => void;
  uploadResponse = new Promise(resolve => { releaseUpload = resolve; });
  try {
    await page.getByRole('button', { name: 'Upload & link images' }).click();
    await expect(page.getByText('Upload in progress', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Image upload in progress' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uploading & linking…' })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('zip-uploading.png'), fullPage: true });
  } finally { releaseUpload(); }
  await expect(page.getByText('1 image file uploaded to B2 and linked to 1 question.')).toBeVisible();
  await expect(page.getByText('Upload successful', { exact: true })).toBeVisible();
  await expect(page.getByText('Uploaded & linked', { exact: true })).toHaveCount(2);
  await expect(page.getByLabel('Option B', { exact: true })).toHaveValue(/!\[Option B\]\(.*\/api\/upload\/image\//);
  const image = page.getByRole('img', { name: 'Question 1 image preview', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const saved = await request.get(`${backend}/api/mocktest/admin/slots/browser-practice/questions?examSlug=ssc-cgl&examMode=ssc`, { headers: { Authorization: `Bearer ${token}` } });
  const paper = await saved.json();
  const question = paper.questions.find((q: { id: string }) => q.id === 'ga-0');
  expect(question.options[1]).toBe(`![Option B](${question.questionImage})`);
  const object = await request.get(`${backend}${question.questionImage}`);
  expect(object.ok()).toBeTruthy(); expect(object.headers()['content-type']).toContain('image/webp');
  const guide = await request.get(`${frontend}/docs/paper-image-zip-policy.md`);
  expect(guide.ok()).toBeTruthy(); expect(await guide.text()).toContain('## Errors and corrective actions');
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('zip-linked.png'), fullPage: true });
});
