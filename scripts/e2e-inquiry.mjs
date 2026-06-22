// Public inquiry capture e2e. Requires: `npm run dev` running + Supabase env configured.
//   Run: node scripts/e2e-inquiry.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4321';
const browser = await chromium.launch();
const page = await browser.newPage();

// Open a work page and submit an inquiry.
await page.goto(`${BASE}/works`, { waitUntil: 'networkidle' });
const href = await page.evaluate(() => document.querySelector('a[href^="/works/"]')?.getAttribute('href'));
if (!href) { console.error('No work links found'); process.exit(1); }
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });

await page.evaluate(() => window.openInquiry('E2E test work', 'e2e'));
await page.fill('#inquireForm [name=name]', 'E2E Tester');
await page.fill('#inquireForm [name=email]', 'e2e@example.com');
await page.fill('#inquireForm [name=message]', 'Automated test inquiry.');
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith('/api/inquire')),
  page.click('#inquireForm button[type=submit]'),
]);
const status = resp.status();
const body = await resp.json().catch(() => ({}));
await page.waitForTimeout(300);
const thanked = await page.locator('#inquireForm', { hasText: 'Thank you' }).count();

await browser.close();
if (status === 200 && body.ok && thanked) {
  console.log('PASS — inquiry captured (200 ok, thank-you shown)');
} else {
  console.error('FAIL', { status, body, thanked });
  process.exit(1);
}
