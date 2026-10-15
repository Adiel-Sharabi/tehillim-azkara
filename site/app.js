// The reading page. The link holds the shared order (lib/template.js owns its format); display choices
// are private to this device (localStorage). Every text comes from the local data files; nothing is
// fetched from any other service.

import {
  TEMPLATES, DEFAULT_TEMPLATE, buildOrder, defaultKeys, addableKeys, fullName,
  inputsFromParams, paramsFromInputs,
} from './lib/template.js';
import { hebrewNumeral, MAQAF } from './lib/hebrew.js';
import { el, buildLabel } from './util.js';
import { openShare, qrSvg } from './share.js';
import { printSheet, printBooklet, setPageRule } from './print.js';
import { feedbackEnabled, openFeedback, wireFeedback } from './feedback.js';

const $ = (id) => document.getElementById(id);
const PREFS_KEY = 'tehillim-view';
const FONTS = [
  { id: 'frank', name: `פרנק${MAQAF}ריהל`, note: 'כמו בסידור' },
  { id: 'keter', name: 'כתר', note: 'בסגנון כתר ירושלים' },
  { id: 'nachlieli', name: 'נחליאלי', note: 'פשוט, בלי תגים' },
];
// Each must draw cantillation, not only vowels (Hadasim and Simple CLM were tried and drop the marks).
const FONT_FAMILY = { frank: 'Frank Ruehl CLM', keter: 'Keter YG', nachlieli: 'Nachlieli CLM' };
const KIND_GROUP = { psalm: 'psalms', psalm119: 'psalm119', mishnah: 'mishnah', prayer: 'prayer' };

const prefs = { marks: 'withNikkud', scale: 1, font: 'frank', theme: 'system', ...loadPrefs() };
const state = { inputs: null, order: null, psalms: null, library: null, build: 'dev' };

// ---- preferences (this device only) ----
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}; } catch { return {}; }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode: not kept */ }
}
function applyPrefs() {
  const root = document.documentElement;
  root.style.setProperty('--scale', prefs.scale);
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.dataset.theme = prefs.theme;
  else delete root.dataset.theme;
  if (prefs.font && prefs.font !== 'frank') root.dataset.font = prefs.font;
  else delete root.dataset.font;
  $('size-out').value = `${Math.round(prefs.scale * 100)}%`;
  for (const r of document.querySelectorAll('input[name="marks"]')) r.checked = r.value === prefs.marks;
  for (const r of document.querySelectorAll('input[name="theme"]')) r.checked = r.value === (prefs.theme ?? 'system');
  for (const r of document.querySelectorAll('input[name="font"]')) r.checked = r.value === prefs.font;
}

// ---- text lookup ----
function has(s) {
  if (s.kind === 'psalm') {
    const ch = state.psalms.chapters[String(s.chapter)];
    return !!ch && (s.to ?? 0) <= ch.length;
  }
  if (s.kind === 'psalm119') return !!state.psalms.chapters['119'];
  if (s.kind === 'mishnah') {
    const ch = state.library.mishnah[s.ref];
    if (!ch) return false;
    for (let n = s.from; n <= s.to; n++) if (!ch[n]) return false;
    return true;
  }
  return !!state.library.prayers[s.text];
}

function verses(chapter, from, to) {
  const p = el('p', { className: 'scripture' });
  for (const v of state.psalms.chapters[chapter].slice(from - 1, to)) {
    p.append(el('span', { className: 'verse' }, el('span', { className: 'vn' }, hebrewNumeral(v.v)), v[prefs.marks]), ' ');
  }
  return p;
}

const RENDER = {
  psalm: (s) => [verses(String(s.chapter), s.from ?? 1, s.to ?? state.psalms.chapters[String(s.chapter)].length)],
  psalm119: (s) => s.groups.map((g) => el('div', { className: 'letter-group' },
    el('div', { className: 'letter-head' },
      el('span', { className: 'letter-big', ariaHidden: 'true' }, g.letter),
      el('h3', { className: 'letter-sub' }, `אות ${g.letter} · פסוקים ${hebrewNumeral(g.from)}–${hebrewNumeral(g.to)}`)),
    verses('119', g.from, g.to))),
  mishnah: (s) => {
    const chapter = state.library.mishnah[s.ref];
    const out = [];
    for (let n = s.from; n <= s.to; n++) {
      out.push(el('p', { className: 'scripture mishnah' }, el('span', { className: 'num' }, `${hebrewNumeral(n)} `), chapter[n][prefs.marks]));
    }
    return out;
  },
  prayer: (s) => {
    const segs = state.library.prayers[s.text];
    const p = el('p', { className: 'scripture prayer' });
    let prev = '';
    for (const seg of segs) {
      const text = seg.slot === 'name' ? s.name : seg[prefs.marks];
      // Segments are joined with a space, except after a maqaf, which binds to the next word.
      if (prev && !prev.endsWith(MAQAF)) p.append(' ');
      p.append(el('span', { className: seg.slot ? 'slot' : seg.together ? `${seg.role} together` : seg.role }, text));
      prev = text;
    }
    const out = [p];
    if (segs.some((g) => g.role === 'congregation')) {
      const legend = el('p', { className: 'legend' }, 'בצבע ', el('b', {}, 'מודגש'), ': מה שהקהל עונה.');
      if (segs.some((g) => g.together)) legend.append(' ', el('b', { className: 'together' }, 'בקו תחתון'), ': אומרים יחד עם הקהל.');
      out.unshift(legend);
    }
    return out;
  },
};

// What a feedback report says about where it came from (lib/feedback.js lists the fields).
function feedbackContext(sectionTitle = '') {
  return { section: sectionTitle, template: state.inputs?.template ?? '', link: location.href, build: state.build };
}

function section(s, i, prevKind) {
  const head = el('div', { className: 'block-head' }, el('h2', { id: `h-${i}` }, s.title));
  if (feedbackEnabled) {
    const report = el('button', { type: 'button', className: 'report linklike' }, 'דיווח על טעות');
    report.addEventListener('click', () => openFeedback(feedbackContext(s.title)));
    head.append(report);
  }
  const groupStart = prevKind && KIND_GROUP[prevKind] !== KIND_GROUP[s.kind];
  const wrap = el('section', { className: `block ${s.kind}${groupStart ? ' group-start' : ''}`, id: `s-${i}`, ariaLabelledby: `h-${i}` }, head);
  if (s.note) wrap.append(el('p', { className: 'note' }, s.note));
  if (has(s)) wrap.append(...RENDER[s.kind](s));
  else wrap.append(el('p', { className: 'missing' }, 'הטקסט של קטע זה עדיין אינו במאגר.'));
  return wrap;
}

// ---- views ----
function currentInputs() {
  return inputsFromParams(new URLSearchParams(location.search));
}

function render() {
  const inputs = currentInputs();
  state.inputs = inputs;
  const showing = !!inputs.name;
  $('start').hidden = showing;
  $('order').hidden = !showing;
  $('open-share').hidden = !showing;
  fillStartForm(inputs);
  if (!showing) {
    document.title = 'סדר אזכרה';
    state.order = null;
    return;
  }

  const order = buildOrder(inputs.template, inputs);
  state.order = order;
  const name = fullName(inputs);
  document.title = `לעילוי נשמת ${name} · סדר אזכרה`;
  $('order-name').textContent = name;
  const tmpl = TEMPLATES[inputs.template];
  $('order-meta').textContent = `נוסח ${tmpl.title} · ${order.sections.length} קטעים`;

  const warnings = [];
  if (inputs.unknownTemplate) warnings.push(`הנוסח שבקישור אינו מוכר כאן, ולכן מוצג נוסח ${tmpl.title}.`);
  if (order.ignored.length) warnings.push(`התווים הבאים בשם אינם אותיות עבריות ולא נכללו בתהילים קי״ט: ${order.ignored.join(' ')}`);
  if (order.unknownKeys.length) warnings.push('חלק מהקטעים שבקישור אינם מוכרים בגרסה זו של האתר ולא הוצגו.');
  $('warnings').textContent = warnings.join(' ');
  $('warnings').hidden = !warnings.length;

  const main = $('reading');
  main.replaceChildren(...order.sections.map((s, i) => section(s, i, order.sections[i - 1]?.kind)));
  $('toc').replaceChildren(...order.sections.map((s, i) => el('li', {}, el('a', { href: `#s-${i}` }, s.title))));
  $('toc-details').open = matchMedia('(min-width: 1100px)').matches;
  fillPrintEnd();
  observeToc();
}

function fillStartForm(inputs) {
  $('name').value = inputs.name;
  $('parent').value = inputs.parent;
  $(inputs.gender === 'female' ? 'g-f' : 'g-m').checked = true;
  for (const r of document.querySelectorAll('input[name="template"]')) r.checked = r.value === inputs.template;
  if (inputs.parent || inputs.gender === 'female') $('more').open = true;
  labelParent('parent', inputs.template);
}

// The picker shows only what the reader chooses by. How well each order is sourced stays in the
// template data and the master doc, not on the page.
function renderTemplateChoices() {
  const entries = Object.entries(TEMPLATES);
  $('templates').replaceChildren(...entries.map(([id, t], i) => el('label', { className: 'choice' },
    el('input', { type: 'radio', name: 'template', value: id, checked: i === 0 }),
    el('strong', {}, t.title),
    el('span', {}, t.description ?? summaryOf(id)))));
  $('e-template').replaceChildren(...entries.map(([id, t]) => el('option', { value: id }, t.title)));
}

// The parent-name field follows the chosen custom: the father's name or the mother's (template.parent).
function labelParent(fieldId, templateId) {
  const mother = TEMPLATES[templateId]?.parent === 'mother';
  const label = document.querySelector(`label[for="${fieldId}"]`);
  label.firstChild.textContent = mother ? 'שם האם ' : 'שם האב ';
  $(fieldId).placeholder = mother ? 'למשל: רחל' : 'למשל: אברהם';
  const hint = $(`${fieldId}-hint`);
  if (!hint) return;
  // Where the custom reads the parent's name: its withParent blocks.
  const t = TEMPLATES[templateId];
  const where = [...new Set([...(t?.blocks ?? []), ...(t?.optional ?? [])].filter((b) => b.withParent)
    .map((b) => (b.type === 'psalm119' ? 'תהילים קי״ט' : b.title.replace(/ (.*)$/, ''))))];
  hint.hidden = !where.length;
  hint.textContent = `יופיע ב${where.join(' וב')}: ״${mother ? 'יוסף בן רחל' : 'משה בן אברהם'}״.`;
}

function summaryOf(templateId) {
  const kinds = new Set(buildOrder(templateId, { name: 'א' }).sections.map((s) => s.kind));
  const parts = [];
  if (kinds.has('psalm') || kinds.has('psalm119')) parts.push('תהילים');
  if (kinds.has('mishnah')) parts.push('משניות');
  if (kinds.has('prayer')) parts.push('קדיש ותפילה');
  return parts.join(' · ');
}

let tocObserver;
function observeToc() {
  tocObserver?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  const links = [...document.querySelectorAll('#toc a')];
  tocObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.id;
      for (const a of links) a.classList.toggle('current', a.getAttribute('href') === `#${id}`);
    }
  }, { rootMargin: '-80px 0px -70% 0px' });
  document.querySelectorAll('.reading .block').forEach((b) => tocObserver.observe(b));
}

// Licenses ask for attribution "in a reasonable manner": all of it is on about.html, and every printed
// copy carries one line pointing there.
const sourcesUrl = () => new URL('about.html', location.href).href;

function fillPrintEnd() {
  $('print-qr').innerHTML = qrSvg(location.href);
  $('print-url').textContent = location.href;
  $('print-src').textContent = `מקורות הטקסט: ${sourcesUrl()}`;
}

// ---- display dialog ----
function renderFontOptions() {
  const sample = state.psalms.chapters['16'][0].withNikkud.split(' ').slice(0, 2).join(' ');
  $('font-options').replaceChildren(...FONTS.map((f) => el('label', {},
    el('input', { type: 'radio', name: 'font', value: f.id }),
    el('span', {}, el('span', {}, el('strong', {}, f.name), ' ', el('small', {}, f.note)),
      el('em', { style: `font-family: '${FONT_FAMILY[f.id]}'` }, sample)))));
  updateSample();
}
function updateSample() {
  $('display-sample').textContent = state.psalms.chapters['16'][0][prefs.marks];
}

// ---- edit dialog ----
function titleFor(key, inputs) {
  const s = buildOrder(inputs.template, { ...inputs, name: inputs.name || 'א', order: [key] }).sections[0];
  if (s?.key === 'n') return 'תהילים קי״ט — אותיות השם';
  return s?.title ?? key;
}
function availableKey(key, inputs) {
  const s = buildOrder(inputs.template, { ...inputs, name: inputs.name || 'א', order: [key] }).sections[0];
  return !!s && has(s);
}
function editRow(key, on, inputs) {
  const li = el('li', { className: on ? '' : 'off' });
  li.dataset.key = key;
  const box = el('input', { type: 'checkbox', checked: on });
  box.addEventListener('change', () => li.classList.toggle('off', !box.checked));
  const up = el('button', { type: 'button', className: 'move', ariaLabel: 'למעלה' }, '↑');
  const down = el('button', { type: 'button', className: 'move', ariaLabel: 'למטה' }, '↓');
  up.addEventListener('click', () => { li.previousElementSibling?.before(li); syncMoves(); up.focus(); });
  down.addEventListener('click', () => { li.nextElementSibling?.after(li); syncMoves(); down.focus(); });
  li.append(el('label', {}, box, titleFor(key, inputs)), up, down);
  return li;
}
function syncMoves() {
  const rows = [...$('edit-sections').children];
  rows.forEach((li, i) => {
    const [up, down] = li.querySelectorAll('.move');
    up.disabled = i === 0;
    down.disabled = i === rows.length - 1;
  });
}
function fillEditRows(inputs, keys) {
  const extra = addableKeys(inputs.template).map((a) => a.key).filter((k) => !keys.includes(k));
  const rows = [...keys.map((k) => [k, true]), ...extra.map((k) => [k, false])].filter(([k]) => availableKey(k, inputs));
  $('edit-sections').replaceChildren(...rows.map(([k, on]) => editRow(k, on, inputs)));
  syncMoves();
}
function editInputs() {
  return {
    template: $('e-template').value,
    name: $('e-name').value.trim(),
    parent: $('e-parent').value.trim(),
    gender: $('eg-f').checked ? 'female' : 'male',
  };
}
function openEdit() {
  const i = state.inputs;
  $('e-name').value = i.name;
  $('e-parent').value = i.parent;
  $(i.gender === 'female' ? 'eg-f' : 'eg-m').checked = true;
  $('e-template').value = i.template;
  labelParent('e-parent', i.template);
  fillEditRows(i, i.order ?? defaultKeys(i.template));
  $('dlg-edit').showModal();
}

// ---- navigation ----
function go(inputs) {
  const url = new URL(location.href);
  url.search = paramsFromInputs(inputs).toString();
  url.hash = '';
  history.pushState(null, '', url);
  render();
  window.scrollTo({ top: 0 });
}

function wire() {
  $('create').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = $('name').value.trim();
    if (!name) {
      $('form-error').textContent = 'נא לכתוב את השם.';
      $('form-error').hidden = false;
      $('name').focus();
      return;
    }
    $('form-error').hidden = true;
    go({
      template: document.querySelector('input[name="template"]:checked')?.value ?? DEFAULT_TEMPLATE,
      name,
      parent: $('parent').value.trim(),
      gender: $('g-f').checked ? 'female' : 'male',
      order: null,
    });
  });
  window.addEventListener('popstate', render);

  // display
  const openDisplay = () => { applyPrefs(); updateSample(); $('dlg-display').showModal(); };
  $('open-display').addEventListener('click', openDisplay);
  $('dlg-display').addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'marks') prefs.marks = t.value;
    if (t.name === 'theme') prefs.theme = t.value;
    if (t.name === 'font') prefs.font = t.value;
    savePrefs();
    applyPrefs();
    updateSample();
    if (t.name === 'marks' && state.order) render();
  });
  const resize = (d) => {
    prefs.scale = Math.min(2.4, Math.max(0.8, +(prefs.scale + d).toFixed(2)));
    savePrefs();
    applyPrefs();
  };
  $('larger').addEventListener('click', () => resize(0.1));
  $('smaller').addEventListener('click', () => resize(-0.1));

  // share, print, edit
  const share = () => openShare({ url: location.href, name: fullName(state.inputs) });
  $('act-share').addEventListener('click', share);
  $('open-share').addEventListener('click', share);
  $('act-print').addEventListener('click', () => {
    $('print-status').textContent = '';
    $('dlg-print').showModal();
  });
  const printCtx = () => ({
    url: location.href,
    name: fullName(state.inputs),
    templateTitle: TEMPLATES[state.inputs.template].title,
    kinds: summaryOf(state.inputs.template),
    sourcesUrl: sourcesUrl(),
  });
  $('print-sheet').addEventListener('click', () => { $('dlg-print').close(); printSheet(); });
  $('print-booklet').addEventListener('click', async () => {
    $('print-status').textContent = 'מכין את החוברת…';
    const info = await printBooklet(printCtx());
    $('print-status').textContent = `החוברת: ${info.pages} עמודים על ${info.sheets} גיליונות A4.`;
    $('dlg-print').close();
  });
  $('act-edit').addEventListener('click', openEdit);
  $('e-template').addEventListener('change', () => {
    labelParent('e-parent', $('e-template').value);
    fillEditRows(editInputs(), defaultKeys($('e-template').value));
  });
  $('templates').addEventListener('change', (ev) => { if (ev.target.name === 'template') labelParent('parent', ev.target.value); });
  $('edit-reset').addEventListener('click', () => fillEditRows(editInputs(), defaultKeys($('e-template').value)));
  $('edit-save').addEventListener('click', () => {
    const base = editInputs();
    if (!base.name) { $('e-name').focus(); return; }
    const order = [...$('edit-sections').children].filter((li) => li.querySelector('input').checked).map((li) => li.dataset.key);
    $('dlg-edit').close();
    go({ ...base, order });
  });

  // feedback
  wireFeedback();
  $('feedback-general').hidden = !feedbackEnabled;
  $('feedback-general').addEventListener('click', () => openFeedback(feedbackContext()));

  // close any dialog by tapping its backdrop
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
  }
}

async function loadBuild() {
  state.build = await buildLabel();
  $('build').textContent = `גרסה: ${state.build}`;
}

renderTemplateChoices();
applyPrefs();
setPageRule('sheet');
wire();
const [psalms, library] = await Promise.all(
  ['./data/psalms/psalms_mam.json', './data/reading/library.json'].map(async (u) => (await fetch(u)).json()),
);
Object.assign(state, { psalms, library });
renderFontOptions();
applyPrefs();
await loadBuild();
render();
