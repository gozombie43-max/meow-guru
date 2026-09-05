module.exports = async (browser) => {
  // Local frontend benchmark only. This is not a valid backend access credential.
  const page = await browser.newPage();
  await page.setCookie({ name: 'access_session', value: 'local-performance-fixture', url: 'http://localhost:3100' });
  await page.close();
};
