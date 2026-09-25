module.exports = async (browser) => {
  // Authenticate only against the disposable fixture. Never use production credentials.
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:3111/live')).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Performance API fixture did not start');
  const login = await fetch('http://127.0.0.1:3111/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'browser-lighthouse@example.test', password: 'Browser-fixture-123!' }),
  });
  if (!login.ok) throw new Error(`Performance fixture login failed: ${login.status}`);
  const refreshToken = login.headers.getSetCookie().find(value => value.startsWith('refreshToken='))?.split(';')[0].slice('refreshToken='.length);
  if (!refreshToken) throw new Error('Fixture login did not return a refresh cookie');
  const page = await browser.newPage();
  await page.setCookie(
    { name: 'access_session', value: 'local-performance-fixture', url: 'http://127.0.0.1:3100' },
    { name: 'refreshToken', value: refreshToken, url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' },
  );
  await page.close();
};
