import { pathToFileURL } from 'node:url';
const { chromium } = process.env.HIVEDESK_PLAYWRIGHT
  ? await import(pathToFileURL(process.env.HIVEDESK_PLAYWRIGHT).href)
  : await import('playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL('../design/share.html', import.meta.url).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('../public/share.png', import.meta.url).pathname });
  console.log('Rendered web/public/share.png (1200 × 630).');
} finally { await browser.close(); }
