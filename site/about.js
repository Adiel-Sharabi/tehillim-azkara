// about.html: every text source the reading uses, with its license (the attribution the licenses ask
// for lives here, not on the reading page), and the site's build label. The list comes from the same
// data files the reading page loads, so a new edition shows up here without editing this page.

import { MAQAF } from './lib/hebrew.js';
import { el, buildLabel } from './util.js';

const $ = (id) => document.getElementById(id);

// Which reading text each edition supplies (keys of library.json "editions").
const USED_FOR = {
  mishnah: 'משניות',
  kaddish: 'קדיש, נוסח אשכנז',
  elMale: `א${MAQAF}ל מלא רחמים`,
  kaddishSefard: 'קדיש, נוסח ספרד',
  kaddishEdot: 'קדיש, נוסח עדות המזרח ומרוקו',
  kaddishBaladi: 'קדיש, נוסח תימן',
  hashkava: 'השכבה',
  hashkavaBaladi: 'השכבה, נוסח תימן',
  kolYisrael: 'כל ישראל',
};
const LICENSE_NAME = { 'Public Domain': 'נחלת הכלל', CC0: 'CC0 (נחלת הכלל)', 'CC-BY': 'CC BY 3.0' };

const link = (href, text) => (href ? el('a', { href, target: '_blank', rel: 'noopener' }, text) : text);

function item(usedFor, title, titleUrl, license, licenseUrl) {
  return el('li', {},
    el('strong', {}, usedFor),
    el('span', {}, link(titleUrl, title.trim()), ' · ', link(licenseUrl, LICENSE_NAME[license] ?? license)));
}

async function load(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function renderSources() {
  const [psalms, library] = await Promise.all([load('./data/psalms/psalms_mam.json'), load('./data/reading/library.json')]);
  const e = psalms.edition;
  const items = [item('תהילים', e.title, e.attributionUrl, e.license, e.licenseUrl)];
  for (const [key, ed] of Object.entries(library.editions)) {
    items.push(item(USED_FOR[key] ?? key, ed.title, ed.url, ed.license, ed.licenseUrl));
  }
  $('sources').replaceChildren(...items);
}

// "חזרה" returns to the order the reader came from, when they came from this site.
try {
  const ref = new URL(document.referrer);
  if (ref.origin === location.origin) $('back').href = ref.href;
} catch { /* no referrer */ }

renderSources().catch(() => { $('sources').replaceChildren(el('li', {}, 'לא ניתן לטעון את רשימת המקורות כרגע.')); });
buildLabel().then((label) => { $('build').textContent = `גרסת האתר: ${label}`; });
