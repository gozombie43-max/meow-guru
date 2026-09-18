import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  console.log('--- Automated Browser Verification of Mobile Quiz Engine Design ---');

  // Read the mobile quiz view styles file to extract CSS
  const stylesFilePath = path.join(process.cwd(), 'components/quiz-engine/views/mobile-quiz-view.styles.ts');
  const stylesFileContent = fs.readFileSync(stylesFilePath, 'utf8');

  // Extract raw CSS template literal from mobileQuizViewStyles
  const cssMatch = stylesFileContent.match(/css\.global`([\s\S]*?)`;/);
  if (!cssMatch) {
    throw new Error('Failed to extract CSS from mobile-quiz-view.styles.ts');
  }
  const cssContent = cssMatch[1];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  // Create HTML harness with mobile quiz markup
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mobile Quiz Engine Design Test</title>
      <style>
        :root {
          --safe-top: 0px;
          --safe-right: 0px;
          --safe-bottom: 0px;
          --safe-left: 0px;
          --font-noto-bengali: 'Inter', sans-serif;
        }
        body {
          margin: 0;
          padding: 0;
          background: #090d12;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        ${cssContent}
      </style>
    </head>
    <body>
      <div class="ios-series-quiz" data-theme="dark" data-text-size="md" data-spacing="normal">
        <div class="ios-series-device">
          <header data-ui-chrome="header" class="ios-series-header">
            <div class="ios-series-header-left">
              <button class="ios-series-icon-button" aria-label="Leave quiz">‹</button>
            </div>
            <div class="ios-series-header-center">
              <div class="lang-toggle">
                <div><span class="lang-toggle-option is-active">EN</span></div>
              </div>
            </div>
            <div class="ios-series-header-right">
              <button class="ios-series-icon-button" aria-label="Settings">⚙</button>
              <button class="ios-series-icon-button" aria-label="Menu">☰</button>
            </div>
          </header>

          <main class="ios-series-content" style="padding: 12px 16px;">
            <div class="ios-series-meta-row">
              <div class="ios-series-meta-items">
                <svg class="ios-series-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                <span class="concept-badge">General Science</span>
                <span class="ios-series-meta-separator" aria-hidden="true">·</span>
                <span class="ios-series-exam-label">SSC CGL 2024 Tier 1</span>
              </div>
              <div class="ios-series-timer" role="timer" aria-label="Time: 00:15">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>00:15</span>
              </div>
            </div>

            <section class="ios-series-question-card">
              <div class="ios-series-prompt">
                <p>Which organ in the human body is primarily responsible for filtering metabolic waste from the blood and producing urine?</p>
              </div>
            </section>

            <section class="ios-series-options" aria-label="Answer options">
              <button type="button" class="ios-series-option">
                <span class="ios-series-option-letter">A</span>
                <span class="ios-series-option-value">Liver</span>
                <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
              </button>
              <button type="button" class="ios-series-option is-selected">
                <span class="ios-series-option-letter">B</span>
                <span class="ios-series-option-value">Kidney</span>
                <span class="ios-series-option-status"><span class="ios-series-option-radio is-selected"></span></span>
              </button>
              <button type="button" class="ios-series-option">
                <span class="ios-series-option-letter">C</span>
                <span class="ios-series-option-value">Heart</span>
                <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
              </button>
              <button type="button" class="ios-series-option">
                <span class="ios-series-option-letter">D</span>
                <span class="ios-series-option-value">Lungs</span>
                <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
              </button>
            </section>
          </main>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent, { waitUntil: 'load' });

  // 1. Evaluate default (md) text-size computed styles
  const defaultStyles = await page.evaluate(() => {
    const prompt = document.querySelector('.ios-series-prompt');
    const promptP = document.querySelector('.ios-series-prompt p');
    const metaRow = document.querySelector('.ios-series-meta-row');
    const metaItems = document.querySelector('.ios-series-meta-items');
    const conceptBadge = document.querySelector('.concept-badge');
    const examLabel = document.querySelector('.ios-series-exam-label');
    const timer = document.querySelector('.ios-series-timer');
    const timerSvg = document.querySelector('.ios-series-timer svg');
    const metaIcon = document.querySelector('.ios-series-meta-icon');

    return {
      prompt: {
        fontWeight: window.getComputedStyle(prompt).fontWeight,
        fontSize: window.getComputedStyle(prompt).fontSize,
        lineHeight: window.getComputedStyle(prompt).lineHeight,
      },
      promptP: {
        fontWeight: window.getComputedStyle(promptP).fontWeight,
      },
      metaRow: {
        fontSize: window.getComputedStyle(metaRow).fontSize,
        fontWeight: window.getComputedStyle(metaRow).fontWeight,
      },
      metaItems: {
        fontSize: window.getComputedStyle(metaItems).fontSize,
      },
      conceptBadge: {
        fontSize: window.getComputedStyle(conceptBadge).fontSize,
      },
      examLabel: {
        fontSize: window.getComputedStyle(examLabel).fontSize,
      },
      timer: {
        fontSize: window.getComputedStyle(timer).fontSize,
        height: window.getComputedStyle(timer).height,
      },
      timerSvg: {
        width: window.getComputedStyle(timerSvg).width,
        height: window.getComputedStyle(timerSvg).height,
      },
      metaIcon: {
        width: window.getComputedStyle(metaIcon).width,
        height: window.getComputedStyle(metaIcon).height,
      },
    };
  });

  console.log('\n[TEST 1] Default Text Size (data-text-size="md"):');
  console.log(JSON.stringify(defaultStyles, null, 2));

  // 2. Test data-text-size="sm"
  await page.evaluate(() => {
    document.querySelector('.ios-series-quiz').setAttribute('data-text-size', 'sm');
  });
  const smStyles = await page.evaluate(() => {
    const prompt = document.querySelector('.ios-series-prompt');
    return {
      fontWeight: window.getComputedStyle(prompt).fontWeight,
      fontSize: window.getComputedStyle(prompt).fontSize,
    };
  });
  console.log('\n[TEST 2] Small Text Size (data-text-size="sm"):', smStyles);

  // 3. Test data-text-size="lg"
  await page.evaluate(() => {
    document.querySelector('.ios-series-quiz').setAttribute('data-text-size', 'lg');
  });
  const lgStyles = await page.evaluate(() => {
    const prompt = document.querySelector('.ios-series-prompt');
    return {
      fontWeight: window.getComputedStyle(prompt).fontWeight,
      fontSize: window.getComputedStyle(prompt).fontSize,
    };
  });
  console.log('\n[TEST 3] Large Text Size (data-text-size="lg"):', lgStyles);

  // Reset to md and capture screenshot
  await page.evaluate(() => {
    document.querySelector('.ios-series-quiz').setAttribute('data-text-size', 'md');
  });

  const screenshotDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'mobile-quiz-engine-verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\nScreenshot captured: ${screenshotPath}`);

  // Light theme test
  await page.evaluate(() => {
    document.querySelector('.ios-series-quiz').setAttribute('data-theme', 'light');
    document.body.style.background = '#f8fafc';
  });
  const lightScreenshotPath = path.join(screenshotDir, 'mobile-quiz-engine-light-verified.png');
  await page.screenshot({ path: lightScreenshotPath, fullPage: false });
  console.log(`Light theme screenshot captured: ${lightScreenshotPath}`);

  await browser.close();

  // Assertions
  const assertions = [
    { name: 'Prompt Font Weight is 400 (normal)', pass: ['400', 'normal'].includes(defaultStyles.prompt.fontWeight) },
    { name: 'Prompt Paragraph Font Weight is 400', pass: ['400', 'normal'].includes(defaultStyles.promptP.fontWeight) },
    { name: 'Prompt sm Variant Font Weight is 400', pass: ['400', 'normal'].includes(smStyles.fontWeight) },
    { name: 'Prompt lg Variant Font Weight is 400', pass: ['400', 'normal'].includes(lgStyles.fontWeight) },
    { name: 'Meta Row Font Size is 12px (reduced from 14px)', pass: defaultStyles.metaRow.fontSize === '12px' },
    { name: 'Concept Badge Font Size is 12px', pass: defaultStyles.conceptBadge.fontSize === '12px' },
    { name: 'Exam Label Font Size is 12px', pass: defaultStyles.examLabel.fontSize === '12px' },
    { name: 'Timer Font Size is 12px (reduced from 13px)', pass: defaultStyles.timer.fontSize === '12px' },
    { name: 'Timer SVG Icon Width is 12px', pass: defaultStyles.timerSvg.width === '12px' },
    { name: 'Meta SVG Icon Width is 13px', pass: defaultStyles.metaIcon.width === '13px' },
  ];

  console.log('\n--- VERIFICATION RESULTS ---');
  let allPassed = true;
  for (const a of assertions) {
    console.log(`[${a.pass ? 'PASS' : 'FAIL'}] ${a.name}`);
    if (!a.pass) allPassed = false;
  }

  if (!allPassed) {
    throw new Error('One or more automated browser assertions failed!');
  }

  console.log('\n>>> ALL AUTOMATED BROWSER VERIFICATIONS PASSED SUCCESSFULLY! <<<\n');
}

run().catch((err) => {
  console.error('Error running verification:', err);
  process.exit(1);
});
