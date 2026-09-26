import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const css = (await Promise.all(['app/light-theme.css', 'app/dark-theme.css', 'app/interface.css'].map(p => read(p)))).join('\n');
const mobile = await read('features/quiz/components/views/mobile-quiz-view.css');
const language = (await read('components/LangToggle.tsx')).split('<style>{`')[1].split('`}</style>')[0];

const browser = await chromium.launch();

// 1. Unsubmitted State (Option B selected)
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 815 });
  await page.setContent(`
  <!DOCTYPE html>
  <html lang="en" class="theme-dark">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #080C14; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; }
      :root { --safe-top: 10px; --safe-bottom: 10px; --safe-left: 0px; --safe-right: 0px; }
      ${css}
      ${mobile}
      ${language}
      .lang-toggle-slider { position: absolute; top: 0; bottom: 0; left: 0; }
    </style>
  </head>
  <body>
    <div class="ios-series-quiz" data-theme="dark" data-text-size="md" data-spacing="comfortable">
      <div class="ios-series-device">
        
        <!-- 1. Header: Back · Exam/Section Title · Language · More -->
        <header class="ios-series-header" data-ui-chrome="header">
          <div class="ios-series-header-left">
            <button class="ios-series-icon-button" data-ui-button="state" data-ui-shape="icon" aria-label="Leave quiz">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          </div>
          <div class="ios-series-header-center">
            <div class="lang-toggle">
              <div style="position: relative; display: flex; align-items: center;">
                <div class="lang-toggle-slider" id="slider"></div>
                <button id="btn-en" data-ui-button="state" style="position:relative;z-index:1;border:0;background:transparent" class="lang-toggle-option is-active">English</button>
                <div class="lang-toggle-divider"></div>
                <button data-ui-button="state" style="position:relative;z-index:1;border:0;background:transparent" class="lang-toggle-option">हिंदी</button>
                <div class="lang-toggle-divider"></div>
                <button data-ui-button="state" style="position:relative;z-index:1;border:0;background:transparent" class="lang-toggle-option">বাংলা</button>
              </div>
            </div>
          </div><div class="ios-series-header-right">
            <button class="ios-series-icon-button" data-ui-button="state" data-ui-shape="icon" aria-label="Open quiz settings">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button class="ios-series-icon-button" data-ui-button="state" data-ui-shape="icon" aria-label="Open question navigator"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>
          </div>
        </header>

        <!-- 2. Question Navigator -->
        <nav class="ios-series-rail" aria-label="Question navigation">
          <button data-ui-button="state" class="ios-series-question is-answered"><span class="ios-series-question-num">1</span></button>
          <button data-ui-button="state" class="ios-series-question is-current"><span class="ios-series-question-num">2</span><span class="ios-series-question-bar"></span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">3</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">4</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">5</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">6</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">7</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">8</span></button>
        </nav>

        <!-- 3. Content -->
        <main class="ios-series-content">
          <div class="ios-series-meta-row">
            <div class="ios-series-meta-items">
              <span>Sum Of Positions + 2�Letter Count</span>
              <span class="ios-series-meta-separator">·</span>
              <span class="ios-series-exam-label">SSC CGL</span>
            </div>
            <div class="ios-series-timer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>00:07</span>
            </div>
          </div>

          <section class="ios-series-question-card">
            <div class="ios-series-prompt">
              <p>In a certain code language, '<span class="quote-highlight">YATCH</span>' is coded as 67, and '<span class="quote-highlight">DINE</span>' is coded as 40. How will '<span class="quote-highlight">MANGO</span>' be coded in that language?</p>
            </div>
          </section>

          <section class="ios-series-options" aria-label="Answer options">
            <button class="ios-series-option" data-ui-button="state">
              <span class="ios-series-option-letter">A</span>
              <span class="ios-series-option-value" style="font-family:inherit">57</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
            </button>
            
            <button class="ios-series-option" data-ui-button="state" aria-pressed="false">
              <span class="ios-series-option-letter">B</span>
              <span class="ios-series-option-value" style="font-family:inherit">60</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
            </button>
            
            <button class="ios-series-option" data-ui-button="state">
              <span class="ios-series-option-letter">C</span>
              <span class="ios-series-option-value" style="font-family:inherit">62</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
            </button>
            
            <button class="ios-series-option" data-ui-button="state">
              <span class="ios-series-option-letter">D</span>
              <span class="ios-series-option-value" style="font-family:inherit">65</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio"></span></span>
            </button>
          </section>
        </main>

        <!-- 4. Footer -->
        <footer class="ios-series-footer" data-ui-chrome="footer">
          <button data-ui-button="secondary" class="ios-series-footer-btn ios-series-footer-prev">
            <svg class="ios-series-btn-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Previous</span>
          </button>

          <div class="ios-series-footer-pill" role="group" aria-label="Solution and AI Tutor actions">
            <button data-ui-button="state" class="ios-series-pill-item ios-series-pill-solution is-disabled" disabled>
              <svg class="ios-series-pill-icon solution-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 2.5v3M12 2.5v3M16 2.5v3M8 10h8M8 14h8M8 18h5"/></svg>
              <span class="ios-series-pill-label">Solution</span>
            </button>
            <div class="ios-series-pill-divider"></div>
            <button data-ui-button="state" class="ios-series-pill-item ios-series-pill-ai is-disabled" disabled>
              <svg class="ios-series-pill-icon ai-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>
              <span class="ios-series-pill-label">Ask AI</span>
            </button>
          </div>

          <button data-ui-button="primary" class="ios-series-footer-btn ios-series-footer-next">
            <span>Submit</span><svg class="ios-series-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
          </button>
        </footer>

      </div>
    </div>
    <script>
      const btn = document.getElementById('btn-en');
      const slider = document.getElementById('slider');
      if (btn && slider) {
        slider.style.width = btn.offsetWidth + 'px';
        slider.style.left = btn.offsetLeft + 'px';
      }
    </script>
  </body>
  </html>
  `);
  await page.screenshot({ path: 'public/mobile-quiz-refined-dark.png' });
  await page.close();
}

// 2. Submitted State (Correct B chosen, Solution & Ask AI active, Next button ready)
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 815 });
  await page.setContent(`
  <!DOCTYPE html>
  <html lang="en" class="theme-dark">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #080C14; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; }
      :root { --safe-top: 10px; --safe-bottom: 10px; --safe-left: 0px; --safe-right: 0px; }
      ${css}
      ${mobile}
      ${language}
      .lang-toggle-slider { position: absolute; top: 0; bottom: 0; left: 0; }
    </style>
  </head>
  <body>
    <div class="ios-series-quiz" data-theme="dark" data-text-size="md" data-spacing="comfortable">
      <div class="ios-series-device">
        
        <header class="ios-series-header" data-ui-chrome="header">
          <div class="ios-series-header-left">
            <button class="ios-series-icon-button" data-ui-button="state" data-ui-shape="icon" aria-label="Leave quiz">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          </div>
          <div class="ios-series-header-center">
            <div class="lang-toggle">
              <div style="position: relative; display: flex; align-items: center;">
                <div class="lang-toggle-slider" id="slider2"></div>
                <button id="btn-en2" data-ui-button="state" style="position:relative;z-index:1;border:0;background:transparent" class="lang-toggle-option is-active">English</button>
                <div class="lang-toggle-divider"></div>
                <button data-ui-button="state" style="position:relative;z-index:1;border:0;background:transparent" class="lang-toggle-option">हिंदी</button>
                <div class="lang-toggle-divider"></div>
                <button data-ui-button="state" style="position:relative;z-index:1;border:0;background:transparent" class="lang-toggle-option">বাংলা</button>
              </div>
            </div>
          </div><div class="ios-series-header-right">
            <button class="ios-series-icon-button" data-ui-button="state" data-ui-shape="icon" aria-label="Open quiz settings">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button class="ios-series-icon-button" data-ui-button="state" data-ui-shape="icon" aria-label="Open question navigator"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>
          </div>
        </header>

        <nav class="ios-series-rail" aria-label="Question navigation">
          <button data-ui-button="state" class="ios-series-question is-correct"><span class="ios-series-question-num">1</span></button>
          <button data-ui-button="state" class="ios-series-question is-current"><span class="ios-series-question-num">2</span><span class="ios-series-question-bar"></span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">3</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">4</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">5</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">6</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">7</span></button>
          <button data-ui-button="state" class="ios-series-question"><span class="ios-series-question-num">8</span></button>
        </nav>

        <main class="ios-series-content">
          <div class="ios-series-meta-row">
            <div class="ios-series-meta-items">
              <span>Sum Of Positions + 2�Letter Count</span>
              <span class="ios-series-meta-separator">·</span>
              <span class="ios-series-exam-label">SSC CGL</span>
            </div>
            <div class="ios-series-timer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>00:07</span>
            </div>
          </div>

          <section class="ios-series-question-card">
            <div class="ios-series-prompt">
              <p>In a certain code language, '<span class="quote-highlight">YATCH</span>' is coded as 67, and '<span class="quote-highlight">DINE</span>' is coded as 40. How will '<span class="quote-highlight">MANGO</span>' be coded in that language?</p>
            </div>
          </section>

          <section class="ios-series-options" aria-label="Answer options">
            <button class="ios-series-option is-dimmed" data-ui-button="state" disabled>
              <span class="ios-series-option-letter">A</span>
              <span class="ios-series-option-value" style="font-family:inherit">57</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio is-dimmed"></span></span>
            </button>
            
            <button class="ios-series-option is-correct is-user-answer" data-ui-button="state" disabled>
              <span class="ios-series-option-letter">B</span>
              <span class="ios-series-option-value" style="font-family:inherit">60</span>
              <span class="ios-series-option-status">
                <span class="ios-series-your-answer">Your answer</span>
                <svg class="ios-series-answer-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M 12 2 C 6.5 2 2 6.5 2 12 C 2 17.5 6.5 22 12 22 C 17.5 22 22 17.5 22 12 C 22 10.9 21.8 9.8007812 21.5 8.8007812 L 19.800781 10.400391 C 19.900781 10.900391 20 11.4 20 12 C 20 16.4 16.4 20 12 20 C 7.6 20 4 16.4 4 12 C 4 7.6 7.6 4 12 4 C 13.6 4 15.100391 4.5007812 16.400391 5.3007812 L 17.800781 3.9003906 C 16.200781 2.7003906 14.2 2 12 2 z M 21.300781 3.3007812 L 11 13.599609 L 7.6992188 10.300781 L 6.3007812 11.699219 L 11 16.400391 L 22.699219 4.6992188 L 21.300781 3.3007812 z"/></svg>
              </span>
            </button>
            
            <button class="ios-series-option is-dimmed" data-ui-button="state" disabled>
              <span class="ios-series-option-letter">C</span>
              <span class="ios-series-option-value" style="font-family:inherit">62</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio is-dimmed"></span></span>
            </button>
            
            <button class="ios-series-option is-dimmed" data-ui-button="state" disabled>
              <span class="ios-series-option-letter">D</span>
              <span class="ios-series-option-value" style="font-family:inherit">65</span>
              <span class="ios-series-option-status"><span class="ios-series-option-radio is-dimmed"></span></span>
            </button>
          </section>
        </main>

        <footer class="ios-series-footer" data-ui-chrome="footer">
          <button data-ui-button="secondary" class="ios-series-footer-btn ios-series-footer-prev">
            <svg class="ios-series-btn-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Previous</span>
          </button>

          <div class="ios-series-footer-pill" role="group" aria-label="Solution and AI Tutor actions">
            <button data-ui-button="state" class="ios-series-pill-item ios-series-pill-solution">
              <svg class="ios-series-pill-icon solution-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 2.5v3M12 2.5v3M16 2.5v3M8 10h8M8 14h8M8 18h5"/></svg>
              <span class="ios-series-pill-label">Solution</span>
            </button>
            <div class="ios-series-pill-divider"></div>
            <button data-ui-button="state" class="ios-series-pill-item ios-series-pill-ai">
              <svg class="ios-series-pill-icon ai-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>
              <span class="ios-series-pill-label">Ask AI</span>
            </button>
          </div>

          <button data-ui-button="primary" class="ios-series-footer-btn ios-series-footer-next">
            <span>Next</span>
            <svg class="ios-series-btn-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </footer>

      </div>
    </div>
    <script>
      const btn2 = document.getElementById('btn-en2');
      const slider2 = document.getElementById('slider2');
      if (btn2 && slider2) {
        slider2.style.width = btn2.offsetWidth + 'px';
        slider2.style.left = btn2.offsetLeft + 'px';
      }
    </script>
  </body>
  </html>
  `);
  await page.screenshot({ path: 'public/mobile-quiz-submitted-dark.png' });
  await page.close();
}

await browser.close();
console.log('Both screenshots refreshed.');
