// Reading page: name -> Psalm 119 by the name's letters, then נשמה.
// All text comes from the local data file; nothing is fetched from outside services.

import { groupsForName } from '../lib/psalm119.js';

const NESHAMA = 'נשמה';
const PREFS_KEY = 'tehillim-view';
const $ = (id) => document.getElementById(id);

const prefs = { marks: 'withNikkud', scale: 1, theme: null, ...loadPrefs() };
let psalms;

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}; } catch { return {}; }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode: prefs just don't persist */ }
}

function applyPrefs() {
  document.documentElement.style.setProperty('--scale', prefs.scale);
  if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
  else delete document.documentElement.dataset.theme;
  $('marks').value = prefs.marks;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  node.append(...children);
  return node;
}

function section(title, groups) {
  const verses = psalms.chapters['119'];
  const wrap = el('section', { className: 'block' }, el('h2', {}, title));
  for (const g of groups) {
    const part = el('div', { className: 'letter-group' }, el('h3', {}, `אות ${g.letter}`));
    const p = el('p', { className: 'scripture' });
    for (const v of verses.slice(g.from - 1, g.to)) {
      p.append(el('span', { className: 'verse' }, v[prefs.marks]), ' ');
    }
    part.append(p);
    wrap.append(part);
  }
  return wrap;
}

function render() {
  const name = new URLSearchParams(location.search).get('n')?.trim();
  const main = $('reading');
  main.replaceChildren();
  $('ignored').hidden = true;
  if (!name) return;
  $('name').value = name;

  const byName = groupsForName(name);
  if (byName.ignored.length) {
    $('ignored').textContent = `התווים הבאים אינם אותיות עבריות ולא נכללו: ${byName.ignored.join(' ')}`;
    $('ignored').hidden = false;
  }
  if (byName.groups.length) main.append(section(`תהילים קי״ט — אותיות השם ${name}`, byName.groups));
  main.append(section('תהילים קי״ט — אותיות נשמה', groupsForName(NESHAMA).groups));
}

function attribution() {
  const e = psalms.edition;
  $('attribution').replaceChildren(
    'נוסח המקרא: ',
    el('a', { href: e.attributionUrl, rel: 'noopener' }, 'מקרא על פי המסורה'),
    ', ויקיטקסט העברי, ברישיון ',
    el('a', { href: e.licenseUrl, rel: 'noopener' }, e.license),
    '.',
  );
}

$('create').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const url = new URL(location.href);
  url.searchParams.set('n', $('name').value.trim());
  history.pushState(null, '', url);
  render();
});
window.addEventListener('popstate', render);

$('marks').addEventListener('change', () => { prefs.marks = $('marks').value; savePrefs(); render(); });
$('larger').addEventListener('click', () => { prefs.scale = Math.min(3, +(prefs.scale + 0.15).toFixed(2)); savePrefs(); applyPrefs(); });
$('smaller').addEventListener('click', () => { prefs.scale = Math.max(0.7, +(prefs.scale - 0.15).toFixed(2)); savePrefs(); applyPrefs(); });
$('theme').addEventListener('click', () => {
  const dark = prefs.theme ? prefs.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  prefs.theme = dark ? 'light' : 'dark';
  savePrefs();
  applyPrefs();
});

applyPrefs();
psalms = await (await fetch('../data/psalms/psalms_mam.json')).json();
attribution();
render();
