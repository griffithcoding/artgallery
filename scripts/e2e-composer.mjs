// e2e: verify edit → save (public unchanged) → publish (public updated) + auth gate.
// Run: OWNER_PW='…' node scripts/e2e-composer.mjs   (dev server on :4321)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4321';
const OWNER = { email: process.env.OWNER_EMAIL || 'wgriffith1218@gmail.com', password: process.env.OWNER_PW };
const stamp = `E2E heading ${Date.now()}`;
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
if (!OWNER.password) fail('set OWNER_PW');

const browser = await chromium.launch();

// 1) auth gate: logged-out editor access redirects to login
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/pages/studio-demo`, { waitUntil: 'networkidle' });
  if (!page.url().includes('/admin/login')) fail(`logged-out editor not redirected to login (got ${page.url()})`);
  await ctx.close();
  console.log('OK gate: logged-out → login');
}

// 2) login, edit heading, SAVE (draft) — public must NOT change
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
await page.fill('#email', OWNER.email);
await page.fill('#password', OWNER.password);
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.click('button[type=submit]')]);

await page.goto(`${BASE}/admin/pages/studio-demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900); // composer island mounts
const headingSel = '[data-block-id="head-1"][data-field="text"]';
if (!(await page.$(headingSel))) fail('editor did not render the head-1 heading (route/island not loaded?)');
await page.click(headingSel);
await page.evaluate(({ sel, text }) => {
  const el = document.querySelector(sel);
  el.textContent = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, { sel: headingSel, text: stamp });
await page.click('#composer-save');
await page.waitForTimeout(1000);

const pub1 = await ctx.newPage();
await pub1.goto(`${BASE}/p/studio-demo`, { waitUntil: 'networkidle' });
if ((await pub1.content()).includes(stamp)) fail('public reflected an UNPUBLISHED draft (save leaked to public)');
console.log('OK save: draft did NOT leak to public');

// 3) PUBLISH — public must now reflect the edit
await page.bringToFront();
await page.click('#composer-publish');
await page.waitForTimeout(1100);
await pub1.goto(`${BASE}/p/studio-demo`, { waitUntil: 'networkidle' });
if (!(await pub1.content()).includes(stamp)) fail('public did NOT reflect the PUBLISHED edit');
console.log('OK publish: public reflects the edit');

await browser.close();
console.log('E2E PASSED');
