// Capture a ~60s branded platform tour of the LIVE-equivalent local build.
// Walks public site + CMS at 1080p, bakes on-brand captions into each frame,
// then stitches a crossfade slideshow (gentle zoom) with ffmpeg.
//   Run: node scripts/capture-tour.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = path.resolve('.tour-frames');
const VIDEO = process.env.OUT_VIDEO || path.join(os.homedir(), 'Downloads', 'mazlish-platform-tour.mp4');
const W = 1920, H = 1080;
// Credentials via env (no secrets in source). Re-encode runs need none.
//   OWNER_EMAIL / OWNER_PW / CREATOR_EMAIL / CREATOR_PW
const OWNER = { email: process.env.OWNER_EMAIL || 'wgriffith1218@gmail.com', password: process.env.OWNER_PW || '' };
const CREATOR = { email: process.env.CREATOR_EMAIL || 'artist@versogallery.com', password: process.env.CREATOR_PW || '' };

const D = 5.3;   // seconds per frame
const T = 0.7;   // crossfade seconds
const FPS = 30;

const REENCODE = process.env.REENCODE === '1';
if (!REENCODE) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
}

const frames = []; // { file, kind }
const pad = (n) => String(n).padStart(2, '0');
function nextFile() { const f = path.join(OUT, `frame-${pad(frames.length)}.png`); return f; }

async function settle(page, ms = 800) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  await page.waitForTimeout(ms);
}

async function caption(page, eyebrow, label) {
  await page.evaluate(({ eyebrow, label }) => {
    document.getElementById('__cap')?.remove();
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.innerHTML =
      `<div style="font:600 13px/1 ui-sans-serif,Inter,Helvetica,Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#e7b9ad;margin-bottom:10px;">${eyebrow}</div>` +
      `<div style="font:500 34px/1.15 Georgia,'Times New Roman',serif;color:#fff;letter-spacing:.005em;">${label}</div>`;
    Object.assign(cap.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0',
      padding: '120px 56px 44px',
      background: 'linear-gradient(transparent, rgba(18,22,36,.0) 8%, rgba(18,22,36,.82))',
      zIndex: '2147483647', pointerEvents: 'none', textShadow: '0 1px 10px rgba(0,0,0,.45)',
    });
    document.body.appendChild(cap);
  }, { eyebrow, label });
  await page.waitForTimeout(150);
}

async function shoot(page, eyebrow, label, { scrollY = 0 } = {}) {
  if (scrollY) { await page.evaluate((y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), scrollY); await page.waitForTimeout(450); }
  await caption(page, eyebrow, label);
  const file = nextFile();
  await page.screenshot({ path: file });
  frames.push({ file });
  console.log('  shot', path.basename(file), '·', label);
}

async function card(page, lines) {
  const fontLink = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prata&display=swap">`;
  await page.setContent(`<!doctype html><html><head>${fontLink}<meta charset="utf-8"></head>
    <body style="margin:0;width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;background:#f3ede2;">
      <div style="text-align:center;color:#1b2233;">
        <div style="font:600 14px/1 ui-sans-serif,Inter,Arial,sans-serif;letter-spacing:.34em;text-transform:uppercase;color:#8a2b1f;margin-bottom:26px;">${lines.eyebrow}</div>
        <div style="font:400 72px/1.05 Prata,Georgia,serif;letter-spacing:.01em;">${lines.title}</div>
        ${lines.sub ? `<div style="margin-top:26px;font:400 24px/1.4 Georgia,serif;color:#54607a;">${lines.sub}</div>` : ''}
      </div>
    </body></html>`, { waitUntil: 'load' });
  await page.waitForTimeout(1100); // let Prata load
  const file = nextFile();
  await page.screenshot({ path: file });
  frames.push({ file });
  console.log('  card', path.basename(file), '·', lines.title);
}

async function login(ctx, creds) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);
  await settle(page);
  return page;
}

if (REENCODE) {
  for (const f of readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()) frames.push({ file: path.join(OUT, f) });
  console.log(`Reusing ${frames.length} frames from ${OUT}`);
} else {
const browser = await chromium.launch();

// ---- Title card (use a throwaway context) ----
{
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await card(page, { eyebrow: 'Mazlish + Wright Contemporary', title: 'Platform Tour', sub: 'A custom gallery website + content studio' });
  await ctx.close();
}

// ---- Public site (no auth) ----
{
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'The public gallery', 'A refined editorial homepage');

  await page.goto(BASE + '/artists', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'Represented artists', 'Featured artists, surfaced first');

  // First artist → public profile
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/artists/"]');
    return a ? a.getAttribute('href') : null;
  });
  if (href) {
    await page.goto(BASE + href, { waitUntil: 'networkidle' }); await settle(page);
    await shoot(page, 'Artist profile', 'Portrait, biography & available works');
    await shoot(page, 'Credentials', 'Representation, education, CV & links', { scrollY: 360 });
  }

  await page.goto(BASE + '/works', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'The collection', 'Browse the full catalogue');

  await ctx.close();
}

// ---- Owner CMS ----
{
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await login(ctx, OWNER);

  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'Gallery CMS', 'One warm, editorial admin');

  await page.goto(BASE + '/admin/artists', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'Artist records', 'Work counts · featured-first ordering');

  const edit = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/admin/artists/"]')]
      .find((el) => !/\/new$/.test(el.getAttribute('href') || ''));
    return a ? a.getAttribute('href') : null;
  });
  if (edit) {
    await page.goto(BASE + edit, { waitUntil: 'networkidle' }); await settle(page);
    await shoot(page, 'Edit an artist', 'Full enriched record');
    await shoot(page, 'Representation & curation', 'Represented-since, CV upload, featured flag', { scrollY: 520 });
  }

  await ctx.close();
}

// ---- Creator Studio ----
{
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await login(ctx, CREATOR);

  await page.goto(BASE + '/studio', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'Artist Studio', 'A scoped portal for each artist');

  await page.goto(BASE + '/studio/profile', { waitUntil: 'networkidle' }); await settle(page);
  await shoot(page, 'Self-service profile', 'Artists maintain their own details', { scrollY: 200 });

  await ctx.close();
}

// ---- End card ----
{
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await card(page, { eyebrow: 'Live now', title: 'Mazlish + Wright', sub: 'Custom website · CMS · artist studio' });
  await ctx.close();
}

await browser.close();
console.log(`Captured ${frames.length} frames → ${OUT}`);
}

// ---------- ffmpeg assembly: gentle-zoom crossfade slideshow ----------
const N = frames.length;
const durFrames = Math.round(D * FPS);
const inputs = [];
const pre = [];
for (let i = 0; i < N; i++) {
  inputs.push('-i', frames[i].file); // single still; zoompan d controls clip length
  // upscale (supersample) → gentle zoom → exact 1080p → 30fps
  pre.push(
    `[${i}:v]scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,` +
    `zoompan=z='min(zoom+0.00060,1.10)':d=${durFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
    `setsar=1,format=yuv420p[v${i}]`
  );
}
const xf = [];
let prev = 'v0';
for (let i = 1; i < N; i++) {
  const out = i === N - 1 ? 'vout' : `x${i}`;
  const offset = (i * (D - T)).toFixed(3);
  xf.push(`[${prev}][v${i}]xfade=transition=fade:duration=${T}:offset=${offset}[${out}]`);
  prev = out;
}
const filter = [...pre, ...xf].join(';');
const total = (N * D - (N - 1) * T).toFixed(1);

const args = [
  '-y', ...inputs,
  '-filter_complex', filter,
  '-map', '[vout]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
  VIDEO,
];
console.log(`Encoding ${N} frames → ~${total}s → ${VIDEO}`);
const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
if (r.status !== 0) { console.error('ffmpeg failed', r.status); process.exit(1); }
console.log('DONE', VIDEO);
