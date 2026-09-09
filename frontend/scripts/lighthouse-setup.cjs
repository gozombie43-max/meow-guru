module.exports = async (browser) => {
  // Local frontend benchmark only. This is not a valid backend access credential.
  const page = await browser.newPage();
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => diagnostics.push(`request: ${request.url()} ${request.failure()?.errorText || 'failed'}`));
  await page.setCookie({
    name: 'access_session',
    value: 'local-performance-fixture',
    url: 'http://localhost:3100',
  });

  const response = await page.goto('http://localhost:3100/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForSelector('body', { timeout: 10_000 });
  // The auth route intentionally streams a text-free Suspense spinner first.
  // Wait for client hydration before deciding whether the page is paintable.
  try {
    await page.waitForFunction(
      () => document.body.innerText.trim().length >= 10,
      { timeout: 30_000 },
    );
  } catch {
    throw new Error(`Lighthouse hydration preflight timed out: ${diagnostics.slice(-8).join(' | ') || 'no browser errors'}`);
  }
  const rendered = await page.evaluate(() => ({
    htmlLength: document.documentElement.outerHTML.length,
    textLength: document.body.innerText.trim().length,
  }));
  if (!response?.ok() || rendered.htmlLength < 100 || rendered.textLength < 10) {
    throw new Error(`Lighthouse render preflight failed: status=${response?.status()} html=${rendered.htmlLength} text=${rendered.textLength}`);
  }
  console.log(
    `Lighthouse render preflight passed: status=${response.status()} html=${rendered.htmlLength} text=${rendered.textLength}`,
  );
  await page.close();
};
