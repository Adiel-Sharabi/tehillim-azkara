// Starting templates, the link format, and the pure builder that turns an order into sections.
//
// A template (lib/templates/) is data: an ordered list of blocks, plus optional blocks a reader may
// add. Every block expands to one or more sections, and every section has a short KEY. An order is a
// list of keys, so a reader's edited order (sections removed, added or moved) fits in the link.
// The site fills in the words from the local data files.

import { groupsForName } from './psalm119.js';
import { hebrewNumeral } from './hebrew.js';
import { TEMPLATES } from './templates/index.js';
import { NESHAMA } from './templates/constants.js';

export { TEMPLATES, NESHAMA };

export const DEFAULT_TEMPLATE = Object.keys(TEMPLATES)[0];
// Shown above every block marked needsMinyan (each Kaddish), always: the page does not ask whether
// there is a minyan (decision ה5).
export const MINYAN_NOTE = 'נאמר במניין';

// Blocks any order may add, whatever template it started from. A template lists its own extras in
// `optional`; these are the ones every custom shares. The site offers only those whose text is in
// the library.
export const EXTRA_BLOCKS = [
  { type: 'prayer', text: 'kaddish-derabbanan', title: 'קדיש דרבנן', needsMinyan: true },
  { type: 'mishnah', ref: 'Mikvaot.7', from: 1, to: 7, title: 'משניות מקוואות פרק ז׳ (כל הפרק)' },
];

// ---- keys ---------------------------------------------------------------------------------------
// Link format v1. Keys use only characters a query string leaves unescaped (letters, digits, - and .),
// and the order joins them with '_'. Changing what a key means breaks every printed QR code: add new
// key forms, never redefine old ones.
//   p<N>                 Psalm N
//   p<N>.<from>.<to>     verses of Psalm N, e.g. p90.17.17 (ויהי נועם)
//   n                    Psalm 119 by the letters of the name
//   s                    Psalm 119 by the letters of נשמה
//   l.<letters>          Psalm 119 by other fixed letters
//   m.<Ref>.<from>.<to>  Mishnah, e.g. m.Mikvaot.7.4.7
//   r.<text-id>          a prayer, e.g. r.kaddish-yatom (gendered texts are chosen at build time)
export const ORDER_SEPARATOR = '_';

function blockSections(b) {
  if (b.type === 'psalms') return b.chapters.map((ch) => ({ key: `p${ch}`, block: { type: 'psalm', chapter: ch } }));
  if (b.type === 'psalm119') {
    if (b.lettersFrom) return [{ key: 'n', block: b }];
    return [{ key: b.letters === NESHAMA ? 's' : `l.${b.letters}`, block: b }];
  }
  if (b.type === 'verses') return [{ key: `p${b.chapter}.${b.from}.${b.to}`, block: b }];
  if (b.type === 'mishnah') return [{ key: `m.${b.ref}.${b.from}.${b.to}`, block: b }];
  if (b.type === 'prayer') return [{ key: `r.${b.text}`, block: b }];
  throw new Error(`unknown block type ${b.type}`);
}

// Every block any template or the shared extras define, by key; the given template's own blocks win,
// so a key carries that custom's details (its titles, withParent). A key not found here is still
// understood from its own form (keyToBlock), so a link keeps working if a template later drops it.
function catalogByKey(templateId) {
  const all = new Map();
  const add = (b) => { for (const s of blockSections(b)) if (!all.has(s.key)) all.set(s.key, s.block); };
  const own = TEMPLATES[templateId];
  const others = Object.entries(TEMPLATES).filter(([id]) => id !== templateId).map(([, t]) => t);
  for (const t of own ? [own, ...others] : others) [...t.blocks, ...(t.optional ?? [])].forEach(add);
  EXTRA_BLOCKS.forEach(add);
  return all;
}

function keyToBlock(key, catalog) {
  if (catalog.has(key)) return catalog.get(key);
  let m;
  if ((m = /^p(\d{1,3})$/.exec(key)) && +m[1] >= 1 && +m[1] <= 150) return { type: 'psalm', chapter: +m[1] };
  if ((m = /^p(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(key)) && +m[1] >= 1 && +m[1] <= 150 && +m[2] >= 1 && +m[2] <= +m[3]) {
    return { type: 'verses', chapter: +m[1], from: +m[2], to: +m[3] };
  }
  if (key === 'n') return { type: 'psalm119', lettersFrom: 'name' };
  if (key === 's') return { type: 'psalm119', letters: NESHAMA };
  if (key.startsWith('l.') && key.length > 2) return { type: 'psalm119', letters: key.slice(2) };
  if ((m = /^m\.(.+)\.(\d+)\.(\d+)$/.exec(key))) return { type: 'mishnah', ref: m[1], from: +m[2], to: +m[3] };
  if ((m = /^r\.([a-z0-9-]+)$/.exec(key))) return { type: 'prayer', text: m[1] };
  return null;
}

export function defaultKeys(templateId) {
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`unknown template ${templateId}`);
  return t.blocks.flatMap(blockSections).map((s) => s.key);
}

// What a reader may add to an order made from this template: its optional blocks first, then the
// shared extras, then the template's own sections (so a removed one can come back). Each with its title.
export function addableKeys(templateId) {
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`unknown template ${templateId}`);
  const catalog = catalogByKey(templateId);
  const keys = [...(t.optional ?? []), ...EXTRA_BLOCKS, ...t.blocks].flatMap(blockSections).map((s) => s.key);
  return [...new Set(keys)].map((key) => ({ key, ...describe(keyToBlock(key, catalog)) }));
}

function mishnahTitle(b) {
  return b.title ?? `משנה ${b.ref} ${b.from === b.to ? b.from : `${b.from}–${b.to}`}`;
}

function describe(b) {
  if (b.type === 'psalm') return { kind: 'psalm', title: `תהילים ${hebrewNumeral(b.chapter)}` };
  if (b.type === 'verses') {
    const range = b.from === b.to ? hebrewNumeral(b.from) : `${hebrewNumeral(b.from)}–${hebrewNumeral(b.to)}`;
    return { kind: 'psalm', title: b.title ?? `תהילים ${hebrewNumeral(b.chapter)}, ${range}` };
  }
  if (b.type === 'psalm119') return { kind: 'psalm119', title: b.lettersFrom ? 'תהילים קי״ט — אותיות השם' : `תהילים קי״ט — אותיות ${b.letters}` };
  if (b.type === 'mishnah') return { kind: 'mishnah', title: mishnahTitle(b) };
  return { kind: 'prayer', title: b.title ?? b.text };
}

// ---- builder ------------------------------------------------------------------------------------
// inputs: { name, gender: 'male' | 'female', parent, order: [keys] | null }
// Unknown keys are skipped and reported in `unknownKeys`; they never break the page.
export function buildOrder(templateId, { name = '', gender = 'male', parent = '', order = null } = {}) {
  const keys = order ?? defaultKeys(templateId);
  const catalog = catalogByKey(templateId);
  const sections = [];
  const unknownKeys = [];
  let ignored = [];
  for (const key of keys) {
    const b = keyToBlock(key, catalog);
    if (!b) { unknownKeys.push(key); continue; }
    const { title } = describe(b);
    if (b.type === 'psalm') {
      sections.push({ key, kind: 'psalm', chapter: b.chapter, title });
    } else if (b.type === 'verses') {
      sections.push({ key, kind: 'psalm', chapter: b.chapter, from: b.from, to: b.to, title });
    } else if (b.type === 'psalm119') {
      // withParent: the custom reads the name with "בן/בת <parent>"; which parent is the family's choice.
      const letters = b.lettersFrom ? (b.withParent ? fullName({ name, gender, parent }) : name) : b.letters;
      const r = groupsForName(letters);
      if (b.lettersFrom) ignored = r.ignored;
      const shown = b.lettersFrom ? `תהילים קי״ט — אותיות השם ${letters}` : title;
      if (r.groups.length) sections.push({ key, kind: 'psalm119', title: shown, groups: r.groups });
    } else if (b.type === 'mishnah') {
      sections.push({ key, kind: 'mishnah', ref: b.ref, from: b.from, to: b.to, title });
    } else {
      const s = { key, kind: 'prayer', text: b.byGender && gender === 'female' ? `${b.text}-female` : b.text, title };
      if (b.needsMinyan) s.note = MINYAN_NOTE;
      if (b.fillName) s.name = b.withParent ? fullName({ name, gender, parent }) : name;
      sections.push(s);
    }
  }
  return { template: templateId, sections, ignored, unknownKeys };
}

// "משה בן אברהם" / "שרה בת רבקה"; just the name when no parent is given.
export function fullName({ name = '', gender = 'male', parent = '' }) {
  const p = parent.trim();
  return p ? `${name} ${gender === 'female' ? 'בת' : 'בן'} ${p}` : name;
}

// ---- link format --------------------------------------------------------------------------------
// ?v=1&t=<template>&n=<name>&g=m|f[&p=<parent>][&o=<keys>]
// Links made before v1 (?n=&g=) read the same way. Unknown params are ignored, including `minyan`,
// which links carried until the page stopped asking (every Kaddish now shows the minyan note). An
// unknown template falls back to the default one and says so. `o` is written only when the order
// differs from the template's own, so an unedited link follows later fixes to its template.
export const LINK_VERSION = '1';

export function inputsFromParams(params) {
  const requested = params.get('t');
  const template = requested && TEMPLATES[requested] ? requested : DEFAULT_TEMPLATE;
  const o = params.get('o');
  return {
    template,
    unknownTemplate: requested && !TEMPLATES[requested] ? requested : null,
    name: params.get('n')?.trim() ?? '',
    gender: params.get('g') === 'f' ? 'female' : 'male',
    parent: params.get('p')?.trim() ?? '',
    order: o ? o.split(ORDER_SEPARATOR).filter(Boolean) : null,
  };
}

export function paramsFromInputs({ template = DEFAULT_TEMPLATE, name, gender, parent = '', order = null }) {
  const p = new URLSearchParams({ v: LINK_VERSION, t: template, n: name, g: gender === 'female' ? 'f' : 'm' });
  if (parent.trim()) p.set('p', parent.trim());
  if (order && order.join(ORDER_SEPARATOR) !== defaultKeys(template).join(ORDER_SEPARATOR)) p.set('o', order.join(ORDER_SEPARATOR));
  return p;
}
