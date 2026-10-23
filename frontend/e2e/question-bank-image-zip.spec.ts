import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const JSZip = createRequire(resolve('../backend/package.json'))('jszip');

const backend = process.env.BACKEND_API_ORIGIN || 'http://127.0.0.1:3111';
const frontend = process.env.QUESTION_BANK_UI_ORIGIN || 'http://127.0.0.1:3110';

test.describe('Question Bank Image ZIP Import E2E', () => {
  test('policy document is publicly accessible and downloadable', async ({ request }) => {
    const response = await request.get(`${frontend}/docs/question-bank-image-zip-policy.md`);
    expect(response.ok(), 'Question Bank ZIP policy document should be publicly downloadable').toBeTruthy();
    const content = await response.text();
    expect(content).toContain('Question Bank');
    expect(content).toContain('## Errors and corrective actions');
    expect(content).toContain('## Limits and forbidden content');
    expect(content).toContain('20 MiB');
  });

  test('validates ZIP targets, reports errors on invalid archives, and executes transactional apply', async ({ page, context, request }, _info) => {
    test.setTimeout(180000);

    // 1. Authenticate as admin fixture
    const login = await request.post(`${backend}/auth/login`, {
      data: { email: 'browser-admin@example.test', password: 'Browser-fixture-123!' },
    });
    expect(login.ok()).toBeTruthy();
    const { token } = await login.json();

    await context.addCookies([
      { name: 'access_session', value: 'local-admin-fixture', url: frontend },
    ]);

    // Intercept and route API calls through backend
    await context.route('**/backend-api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/backend-api/, '');
      if (path === '/auth/refresh') return route.fulfill({ json: { token } });
      const response = await route.fetch({ url: `${backend}${path}${url.search}` });
      await route.fulfill({ response });
    });

    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 2. Navigate to Question Bank Admin Page
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Open Question Bank ZIP import panel (or disclosure)
    const zipDisclosure = page.getByText(/Bulk upload.*image.*\.zip|Question Bank Image ZIP/i);
    if (await zipDisclosure.isVisible()) {
      await zipDisclosure.click();
    }

    // 3. Test Invalid ZIP: missing manifest
    const invalidZip = new JSZip();
    invalidZip.file('unreferenced_file.txt', 'This archive is missing manifest.json');
    const invalidBuffer = await invalidZip.generateAsync({ type: 'nodebuffer' });

    const zipInput = page.getByLabel(/Question Bank image ZIP|ZIP/i).first();
    await zipInput.setInputFiles({
      name: 'invalid_missing_manifest.zip',
      mimeType: 'application/zip',
      buffer: invalidBuffer,
    });

    const validateBtn = page.getByRole('button', { name: 'Validate ZIP', exact: true });
    await validateBtn.click();

    // Verify actionable alert is visible
    const alert = page.getByRole('alert');
    await expect(alert.filter({ hasText: /Missing manifest\.json/i })).toBeVisible();

    // Verify Apply/Upload button is strictly disabled
    const uploadBtn = page.getByRole('button', { name: /Upload & link images/i });
    await expect(uploadBtn).toBeDisabled();

    // 4. Test Valid ZIP: validate and then apply
    const validZip = new JSZip();
    validZip.file(
      'manifest.json',
      JSON.stringify({
        version: 1,
        examMode: 'ssc',
        images: [
          { questionId: 'q1', target: 'question', file: 'images/sample.webp' },
          { questionId: 'q1', target: 'option', option: 'A', language: 'en', file: 'images/sample.webp' },
        ],
      })
    );

    // Read an existing sample webp asset
    let sampleImageBuffer: Buffer;
    try {
      sampleImageBuffer = readFileSync(resolve('public/images/topic-thumbnails/newspaper.webp'));
    } catch {
      // Fallback in-memory valid webp if path differs
      sampleImageBuffer = Buffer.from(
        'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
        'base64'
      );
    }
    validZip.file('images/sample.webp', sampleImageBuffer);
    const validZipBuffer = await validZip.generateAsync({ type: 'nodebuffer' });

    await zipInput.setInputFiles({
      name: 'valid_bank_images.zip',
      mimeType: 'application/zip',
      buffer: validZipBuffer,
    });

    await expect(uploadBtn).toBeDisabled();
    await validateBtn.click();

    // 5. Verify Target Preview renders
    await expect(page.getByText(/Validated: \d+ file.*Review before uploading/i)).toBeVisible();
    await expect(page.getByText(/q1/)).toBeVisible();
    await expect(page.getByText(/option A \(en\)|question \(all languages\)/)).toBeVisible();

    // 6. Execute Apply
    await expect(uploadBtn).toBeEnabled();
    await uploadBtn.click();

    // 7. Verify Success state and Badges
    await expect(page.getByText(/Upload in progress|Keep this page open/i)).toBeVisible();
    await expect(page.getByText(/Upload successful|Successfully updated/i)).toBeVisible();
    await expect(page.getByText('Uploaded & linked', { exact: true })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
