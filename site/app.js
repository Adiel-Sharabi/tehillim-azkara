// Reading page: name + gender + minyan -> the ashkenaz_base order (lib/template.js), rendered from
// the local data files. Nothing is fetched from outside services.

import { buildOrder, inputsFromParams, paramsFromInputs } from '../lib/template.js';
import { hebrewNumeral } from '../lib/hebrew.js';

const TEMPLATE = 'ashkenaz_base';
const PREFS_KEY = 'tehillim-view';
const $ = (id) => document.getElementById(id);

const prefs = { marks: 'withNikkud', scale: 1, theme: null, ...loadPrefs() };
let psalms;
let library;

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

function verses(chapter, from, to) {
  const p = el('p', { className: 'scripture' });
  for (const v of psalms.chapters[chapter].slice(from - 1, to)) p.append(el('span', { className: 'verse' }, v[prefs.marks]), ' ');
  return p;
}

const RENDER = {
  psalm: (s) => [verses(String(s.chapter), 1, psalms.chapters[String(s.chapter)].length)],
  psalm119: (s) => s.groups.map((g) => el('div', { className: 'letter-group' }, el('h3', {}, `אות ${g.letter}`), verses('119', g.from, g.to))),
  mishnah: (s) => {
    const chapter = library.mishnah[s.ref];
    const out = [];
    for (let n = s.from; n <= s.to; n++) {
      out.push(el('p', { className: 'scripture mishnah' }, el('span', { className: 'num' }, `${hebrewNumeral(n)} `), chapter[n][prefs.marks]));
    }
    return out;
  },
  prayer: (s) => {
    const p = el('p', { className: 'scripture prayer' });
    for (const seg of library.prayers[s.text]) {
      const text = seg.slot === 'name' ? s.name : seg[prefs.marks];
      const span = el('span', { className: seg.slot ? 'slot' : seg.role }, text);
      if (seg.role === 'congregation') span.title = 'הקהל עונה';
      p.append(span, ' ');
    }
    return [p];
  },
};

function section(s) {
  const wrap = el('section', { className: `block ${s.kind}` }, el('h2', {}, s.title));
  if (s.note) wrap.append(el('p', { className: 'note' }, s.note));
  wrap.append(...RENDER[s.kind](s));
  return wrap;
}

function render() {
  const inputs = inputsFromParams(new URLSearchParams(location.search));
  const main = $('reading');
  main.replaceChildren();
  $('ignored').hidden = true;
  $('name').value = inputs.name;
  $(inputs.gender === 'female' ? 'g-f' : 'g-m').checked = true;
  $('minyan').checked = inputs.hasMinyan;
  if (!inputs.name) return;

  const order = buildOrder(TEMPLATE, inputs);
  if (order.ignored.length) {
    $('ignored').textContent = `התווים הבאים אינם אותיות עבריות ולא נכללו: ${order.ignored.join(' ')}`;
    $('ignored').hidden = false;
  }
  main.append(...order.sections.map(section));
}

function attribution() {
  const link = (href, text) => el('a', { href, rel: 'noopener' }, text);
  const e = psalms.edition;
  const { mishnah, kaddish, elMale } = library.editions;
  $('attribution').replaceChildren(
    el('p', {}, 'נוסח המקרא: ', link(e.attributionUrl, 'מקרא על פי המסורה'), ', ויקיטקסט העברי, ברישיון ', link(e.licenseUrl, e.license), '.'),
    el('p', {}, 'משנה: ', link(mishnah.url, mishnah.title), ' (נחלת הכלל), דרך ספריא.'),
    el('p', {}, 'קדיש: ', link(kaddish.url, kaddish.title), '; א־ל מלא רחמים: ', link(elMale.url, elMale.title),
      '; דרך ספריא, ברישיון ', link(kaddish.licenseUrl, 'CC BY 3.0'),
      '. שינויים: הוסרו הוראות והערות, ושם ה׳ נכתב יְיָ.'),
  );
}

$('create').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const url = new URL(location.href);
  url.search = paramsFromInputs({
    name: $('name').value.trim(),
    gender: $('g-f').checked ? 'female' : 'male',
    hasMinyan: $('minyan').checked,
  }).toString();
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
[psalms, library] = await Promise.all(
  ['../data/psalms/psalms_mam.json', '../data/reading/library.json'].map(async (u) => (await fetch(u)).json()),
);
attribution();
render();
