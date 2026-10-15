// Printing: an A4 sheet (the page's own print stylesheet), or a folded A5 booklet.
//
// The booklet is laid out here: the reading is poured into A5 pages measured offscreen (a verse or a
// prayer line never splits; long Mishnah text breaks between words), a cover and a back cover with the
// QR code are added, the count is padded to a multiple of 4, and lib/imposition.js decides which two
// pages share each side of each A4 sheet.

import { bookletPageCount, bookletSheets } from './lib/imposition.js';
import { hebrewNumeral } from './lib/hebrew.js';
import { el } from './util.js';
import { qrSvg } from './share.js';

const PAGE_RULES = {
  sheet: '@page { size: A4 portrait; margin: 14mm 15mm 16mm; }',
  booklet: '@page { size: A4 landscape; margin: 0; }',
};

export function setPageRule(mode) {
  let style = document.getElementById('page-rule');
  if (!style) {
    style = el('style', { id: 'page-rule' });
    document.head.append(style);
  }
  style.textContent = PAGE_RULES[mode];
}

function resetPrint() {
  document.documentElement.classList.remove('print-booklet');
  const booklet = document.getElementById('booklet');
  booklet.replaceChildren();
  booklet.hidden = true;
  setPageRule('sheet');
}
window.addEventListener('afterprint', resetPrint);

export function printSheet() {
  resetPrint();
  window.print();
}

// ---- pagination ----

// The reading as a flat list of items per section: atoms (kept whole; headings stay with what follows)
// and paragraphs (split between their inline units).
function itemsOf(sectionEl) {
  const items = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.matches('p.scripture')) items.push({ type: 'para', shell: child, units: unitsOf(child) });
      else if (child.matches('.letter-group')) walk(child);
      else items.push({ type: 'atom', node: child, keepWithNext: child.matches('.block-head, .letter-head, .legend') });
    }
  };
  walk(sectionEl);
  return items;
}

function unitsOf(p) {
  const units = [];
  for (const n of p.childNodes) {
    if (n.nodeType === Node.TEXT_NODE && n.textContent.length > 60) {
      for (const word of n.textContent.split(/(?<=\s)/)) units.push(document.createTextNode(word));
    } else {
      units.push(n);
    }
  }
  return units;
}

// A page: .bk-body is the fixed-height text area; .bk-flow inside it grows with its content, so its
// height says how full the page is (a box's scrollHeight never drops below its own height).
// The folio (page number) is there while measuring, so the text area is the size it will print at.
function newPage(extraClass = '') {
  const flow = el('div', { className: 'bk-flow' });
  const body = el('div', { className: 'bk-body' }, flow);
  const page = el('div', { className: `bk-page ${extraClass}`.trim() }, body, el('div', { className: 'bk-folio' }));
  return { page, body, flow };
}

function paginate(sections, host) {
  const pages = [];
  let cur = newPage();
  host.append(cur.page);
  let shell = null;
  let heads = [];

  // A few pixels of slack: print rasterises glyphs a hair differently from the screen measure.
  const fits = () => cur.flow.offsetHeight <= cur.body.clientHeight - 6;
  const openShell = (sec) => {
    shell = sec.cloneNode(false);
    shell.removeAttribute('id');
    shell.classList.remove('group-start');
    cur.flow.append(shell);
  };
  const turnPage = (sec) => {
    if (shell && !shell.childNodes.length) shell.remove();
    if (cur.flow.childNodes.length) {
      pages.push(cur);
      cur = newPage();
      host.append(cur.page);
    }
    openShell(sec);
  };

  for (const sec of sections) {
    openShell(sec);
    heads = [];
    for (const item of itemsOf(sec)) {
      if (item.type === 'atom') {
        const n = item.node.cloneNode(true);
        shell.append(n);
        if (!fits()) {
          n.remove();
          const moving = heads.splice(0);
          moving.forEach((h) => h.remove());
          turnPage(sec);
          shell.append(...moving, n);
        }
        if (item.keepWithNext) heads.push(n);
        else heads = [];
        continue;
      }
      let p = item.shell.cloneNode(false);
      shell.append(p);
      for (const unit of item.units) {
        const u = unit.cloneNode(true);
        p.append(u);
        if (fits()) { heads = []; continue; }
        u.remove();
        if (!p.textContent.trim()) {
          // Nothing of this paragraph fits here: move it, with the headings that introduce it.
          p.remove();
          const moving = heads.splice(0);
          moving.forEach((h) => h.remove());
          turnPage(sec);
          shell.append(...moving);
          p = item.shell.cloneNode(false);
        } else {
          turnPage(sec);
          p = item.shell.cloneNode(false);
          p.classList.add('cont');
        }
        shell.append(p);
        p.append(u);
        heads = [];
      }
    }
  }
  if (shell && !shell.childNodes.length) shell.remove();
  if (cur.flow.childNodes.length) pages.push(cur);
  return pages.map((pg) => pg.page);
}

function cover(ctx) {
  const { page, body } = newPage('bk-cover');
  page.classList.add('bk-cover');
  body.remove();
  page.append(
    el('p', { className: 'bk-leilui' }, 'לעילוי נשמת'),
    el('h1', { className: 'bk-name' }, ctx.name),
    el('div', { className: 'bk-rule' }),
    el('p', { className: 'bk-sub' }, ctx.kinds),
    el('p', { className: 'bk-sub' }, `נוסח ${ctx.templateTitle}`),
  );
  return page;
}

function backCover(ctx) {
  const { page, body } = newPage('bk-back');
  body.remove();
  const qr = el('div', { className: 'bk-qr' });
  qr.innerHTML = qrSvg(ctx.url);
  page.append(
    qr,
    el('p', {}, 'לסדר בטלפון, לשיתוף ולהדפסה: סרקו את הקוד'),
    el('p', { className: 'bk-url' }, ctx.url),
    el('p', { className: 'bk-fine' }, `מקורות הטקסט: ${ctx.sourcesUrl}`),
  );
  return page;
}

async function fontsReady() {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-text').split(',')[0].trim();
  await Promise.all([`400 12pt ${family}`, `700 12pt ${family}`, '400 10pt Assistant', '700 10pt Assistant'].map((f) => document.fonts.load(f).catch(() => {})));
  await document.fonts.ready;
}

// Lays the booklet out into #booklet and returns its size. Exposed for the print flow and for checks.
export async function buildBooklet(ctx) {
  await fontsReady();
  const measure = el('div', { className: 'bk-measure' });
  document.body.append(measure);
  let content;
  try {
    content = paginate([...document.querySelectorAll('#reading > .block')], measure);
  } finally {
    measure.remove();
  }
  content.forEach((pg, i) => { pg.querySelector('.bk-folio').textContent = hebrewNumeral(i + 2); });

  const pages = [cover(ctx), ...content];
  const total = bookletPageCount(pages.length + 1);
  while (pages.length < total - 1) pages.push(newPage().page); // blank pages go just before the back cover
  pages.push(backCover(ctx));

  const sheets = bookletSheets(total);
  const faces = sheets.flatMap((s) => [s.front, s.back]).map(([left, right]) => el('div', { className: 'bk-sheet' }, pages[left - 1], pages[right - 1]));
  const booklet = document.getElementById('booklet');
  booklet.replaceChildren(...faces);
  return { pages: total, sheets: sheets.length };
}

export async function printBooklet(ctx) {
  resetPrint();
  const info = await buildBooklet(ctx);
  setPageRule('booklet');
  document.documentElement.classList.add('print-booklet');
  document.getElementById('booklet').hidden = false;
  window.print();
  return info;
}
