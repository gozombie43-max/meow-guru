const { chromium, request } = require('../../frontend/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const routes = ['/', '/mathematics', '/reasoning', '/english', '/general-awareness', '/general-awareness/geography', '/mathematics/algebra', '/resource', '/profile', '/mock-test', '/mock-test/ssc-cgl', '/mock-test/ssc-cgl/browser-test', '/battle', '/battle/leaderboard', '/battle/social', '/dashboard', '/notifications', '/ai-chat', '/play', '/play/setup/adaptive', '/english/synonyms-antonyms/study-mode', '/english/one-word-substitution/study-mode', '/english/idioms-phrases/study-mode', '/mathematics/algebra/formula-notes', '/login', '/register', '/access-code', '/admin', '/admin/users', '/admin/notifications', '/admin/mock-pyq', '/admin/upload'];
(async () => {
  const phase = process.argv[2] || 'after';
  const browser = await chromium.launch();
  const api = await request.newContext();
  const login = await api.post('http://127.0.0.1:3111/auth/login', { data: { email: process.env.PALETTE_ADMIN_FIXTURE === '1' ? 'browser-admin@example.test' : 'browser-mobile@example.test', password: 'Browser-fixture-123!' } });
  assert(login.ok());
  const { token, user } = await login.json();
  const selectedRoutes = process.argv[3] ? routes.filter(route => process.argv[3].split(',').includes(route)) : routes;
  const reportPath = path.join(__dirname,`${phase}-report.json`);
  const report = process.argv[3] && fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath,'utf8')) : [];
  await Promise.all([390, 1366].map(async width => { for (const route of selectedRoutes) for (const theme of phase === 'before' ? ['dark'] : ['light', 'dark']) {
    const filename = `${width}-${theme}-${route === '/' ? 'home' : route.slice(1).replaceAll('/','__')}`;
    if (phase === 'before' && fs.existsSync(path.join(__dirname,`${phase}-${filename}.png`))) continue;
    console.log('Capturing',phase,width,theme,route);
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce', colorScheme: theme });
    const guest = ['/login', '/register', '/access-code'].includes(route);
    const admin = route.startsWith('/admin');
    if (!guest) await context.addCookies([{ name: 'access_session', value: 'palette-review', url: 'http://localhost:3000' }]);
    await context.addInitScript(theme => { localStorage.setItem('ui-theme', theme); }, theme);
    await context.route('**/backend-api/**', async r => {
      const url = new URL(r.request().url());
      const pathname = url.pathname.replace(/^\/backend-api/, '');
      if (pathname === '/auth/refresh') return r.fulfill({ status: guest ? 401 : 200, json: guest ? {error:'Guest fixture'} : {token} });
      if (pathname === '/users/me' && admin) return r.fulfill({json:{...user,role:'admin',progress:{},bookmarks:[],recentQuizzes:[]}});
      if (pathname === '/api/battle/season/reward-track') return r.fulfill({json:{season:null,level:0,items:[]}});
      try { const response = await r.fetch({ url: `http://127.0.0.1:3111${pathname}${url.search}`, timeout:10000 }); await r.fulfill({response}); }
      catch { await r.abort(); }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(`http://localhost:3000${route}`, { waitUntil:'domcontentloaded',timeout:60000 });
    await page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth,
      colors: [...document.querySelectorAll('body,main,section,article,header,aside,nav,h1,h2,h3,p,a,button,input,select,textarea')].filter(e => e.checkVisibility()).map(e => {
        const s = getComputedStyle(e);return { tag:e.tagName, cls: e.className, color:s.color, background:s.backgroundColor, image:s.backgroundImage, border:s.borderColor, shadow:s.boxShadow };
      }),
    }));
    const neutralContrast = theme === 'light' ? await page.evaluate(() => {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const painter=canvas.getContext('2d');
      const rgb = value => {
        if(value.startsWith('rgb'))return value.match(/[\d.]+/g)?.map(Number);
        painter.clearRect(0,0,1,1);painter.fillStyle=value;painter.fillRect(0,0,1,1);const c=painter.getImageData(0,0,1,1).data;return [c[0],c[1],c[2],c[3]/255];
      };
      const lum = rgb => rgb.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      const findings=[];
      for(const e of document.querySelectorAll('p,span,small,label,a,button,h1,h2,h3,input,textarea')) {
        if(!e.checkVisibility() || e.closest('[aria-hidden="true"]') || e.matches(':disabled'))continue;
        const bounds=e.getBoundingClientRect();if(bounds.bottom<0 || bounds.top>innerHeight || bounds.right<0 || bounds.left>innerWidth)continue;
        const placeholder=e.matches('input,textarea') && e.hasAttribute('placeholder');
        const text=placeholder ? e.getAttribute('placeholder') : [...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
        if(!text)continue;
        const style=getComputedStyle(e,placeholder?'::placeholder':null), fg=rgb(style.color);
        if(!fg || Math.max(...fg.slice(0,3))-Math.min(...fg.slice(0,3))>36)continue;
        let parent=e,bg;
        while(parent){const s=getComputedStyle(parent);if(Number(s.opacity)<.99 || s.backgroundImage!=='none'){bg=null;break;}const c=rgb(s.backgroundColor);if(c && (c[3] ?? 1)>.98){bg=c;break;}parent=parent.parentElement;}
        if(!bg || lum(bg)<.8)continue;
        const foreground=fg.slice(0,3).map((v,i)=>v*(fg[3] ?? 1)+bg[i]*(1-(fg[3] ?? 1)));
        const ratio=(lum(bg)+.05)/(lum(foreground)+.05);
        const minimum=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.667 && Number(style.fontWeight)>=700)?3:4.5;
        if(ratio<minimum)findings.push({text:text.slice(0,70),cls:e.className,color:style.color,bg:style.backgroundColor,ratio:Math.round(ratio*100)/100,placeholder});
      }
      return findings;
    }) : [];
    const buffer = await page.screenshot({path:path.join(__dirname,`${phase}-${filename}.png`),animations:'disabled'});
    let darkColorsUnchanged;
    if (phase === 'after' && theme === 'dark') {
      const oldPath = path.join(__dirname, `before-${filename}.json`);
      if (fs.existsSync(oldPath)) darkColorsUnchanged = JSON.stringify(state.colors) === JSON.stringify(JSON.parse(fs.readFileSync(oldPath)).colors);
    }
    fs.writeFileSync(path.join(__dirname,`${phase}-${filename}.json`),JSON.stringify(state,null,2));
    const result = {width,route,theme,status:response.status(),finalURL:page.url(),overflow:state.overflow,errors,darkColorsUnchanged,neutralContrast};
    const previous=report.findIndex(x=>x.width===width && x.route===route && x.theme===theme);
    if(previous>=0)report.splice(previous,1);
    report.push(result);
    fs.writeFileSync(path.join(__dirname,`${phase}-report.json`),JSON.stringify(report,null,2));
    console.log(JSON.stringify(result));
    await context.unrouteAll({behavior:'ignoreErrors'});
    await context.close();
  }}));
  await browser.close();await api.dispose();
})().catch(error=>{console.error(error);process.exit(1)});
