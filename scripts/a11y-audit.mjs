#!/usr/bin/env node
// Accessibility gate (IS 5568 / WCAG 2.1 AA): runs axe on every screen of the site, in light and dark,
// at phone and desktop width, and checks what axe cannot: reflow at 320px, and that every control
// keyboard focus lands on is visible and marked. Exits non-zero on any finding.
//
//   npm i --no-save playwright axe-core && npx playwright install chromium
//   node scripts/a11y-audit.mjs
//
// CI runs it before deploying (.github/workflows/pages.yml). Neither package is a dependency of the
// site itself, so they are installed only where the audit runs.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const PORT = 8095;
const BASE = `http://127.0.0.1:${PORT}/`;
const DIALOGS = [['#open-display', 'display'], ['#act-share', 'share'], ['#act-print', 'print'], ['#act-edit', 'edit'], ['#feedback-general', 'feedback']];
const PAGES = ['about.html', 'accessibility.html'];

const server = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url)), String(PORT)], { stdio: 'ignore' });
const findings = [];

async function axe(page, where) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
  for (const v of violations) {
    for (const n of v.nodes) findings.push(`${where}: [${v.impact}] ${v.id} ${n.target.join(' ')} — ${n.failureSummary.split('\n')[1]?.trim() ?? v.help}`);
  }
}

// Tab through the page: each stop must be on screen and carry a focus mark (an outline on itself, or on
// the custom-styled span next to a visually hidden radio).
async function keyboard(page, where, stops = 40) {
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab');
    const bad = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const target = e.matches('input[type=radio], input[type=checkbox]') && getComputedStyle(e).opacity === '0' ? (e.nextElementSibling ?? e.closest('label')) : e;
      const s = getComputedStyle(target);
      const marked = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || getComputedStyle(e.closest('label') ?? e).outlineStyle !== 'none';
      const r = target.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0;
      return marked && visible ? null : `${e.tagName.toLowerCase()}#${e.id || '-'}.${e.className || '-'} ${visible ? 'has no focus mark' : 'is invisible'}`;
    });
    if (bad) findings.push(`${where}: keyboard focus ${bad}`);
  }
}

async function main() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    for (const [vp, viewport] of [['phone', { width: 375, height: 740 }], ['desktop', { width: 1280, height: 900 }]]) {
      const ctx = await browser.newContext({ viewport, colorScheme: scheme, locale: 'he-IL' });
      const page = await ctx.newPage();
      const at = (s) => `${s} (${scheme}, ${vp})`;
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await axe(page, at('start'));
      if (scheme === 'light') await keyboard(page, at('start'), 20);
      await page.fill('#name', 'משה');
      await page.click('button[type=submit]');
      await page.waitForSelector('#reading .block');
      await axe(page, at('order'));
      for (const [button, name] of DIALOGS) {
        if (!(await page.locator(button).isVisible())) { findings.push(`${at('order')}: ${button} is not shown`); continue; }
        await page.click(button);
        await page.waitForSelector('dialog[open]');
        await axe(page, at(`dialog ${name}`));
        if (scheme === 'light' && vp === 'phone') await keyboard(page, at(`dialog ${name}`), 12);
        await page.keyboard.press('Escape');
        await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
      }
      if (scheme === 'light') await keyboard(page, at('order'));
      if (vp === 'phone') {
        await page.setViewportSize({ width: 320, height: 640 });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 1) findings.push(`${at('order')}: scrolls sideways by ${over}px at 320px width`);
      }
      // Back on the start page, the recent-orders list is now showing.
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForSelector('#recent:not([hidden])');
      await axe(page, at('start with history'));
      if (scheme === 'light' && vp === 'phone') await keyboard(page, at('start with history'), 30);
      for (const p of PAGES) {
        await page.goto(BASE + p, { waitUntil: 'networkidle' });
        await axe(page, at(p));
      }
      await ctx.close();
    }
  }
  await browser.close();
}

try {
  await main();
} finally {
  server.kill();
}
if (findings.length) {
  console.error(`${findings.length} accessibility finding(s):\n` + findings.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('accessibility audit: no findings');
