// Starting templates and the pure builder that turns one into an ordered reading.
// A template is data; buildOrder resolves it against the reader's inputs into sections that name
// the text to show (chapter, letter groups, mishnah range, prayer id). The site fills in the words.

import { groupsForName } from './psalm119.js';
import { hebrewNumeral } from './hebrew.js';

export const NESHAMA = 'נשמה';

// ashkenaz_base, master doc Part ג׳. psalms_7 keeps the order of its refs there.
export const TEMPLATES = {
  ashkenaz_base: {
    title: 'אשכנז',
    blocks: [
      { type: 'psalms', chapters: [33, 16, 17, 72, 91, 104, 130] },
      { type: 'psalm119', lettersFrom: 'name' },
      { type: 'psalm119', letters: NESHAMA },
      { type: 'mishnah', ref: 'Mikvaot.7', from: 4, to: 7, title: 'משניות מקוואות פרק ז׳, משניות ד׳–ז׳ (נשמה)' },
      { type: 'prayer', text: 'kaddish-yatom', title: 'קדיש יתום', needsMinyan: true },
      { type: 'prayer', text: 'el-male-rachamim', title: 'א\u05BEל מלא רחמים', byGender: true, fillName: true },
    ],
  },
};

export const MINYAN_NOTE = 'נאמר במניין בלבד';

// inputs: { name, gender: 'male' | 'female', hasMinyan: boolean }
export function buildOrder(templateId, { name = '', gender = 'male', hasMinyan = true } = {}) {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`unknown template ${templateId}`);
  const sections = [];
  let ignored = [];
  for (const b of template.blocks) {
    if (b.type === 'psalms') {
      for (const ch of b.chapters) sections.push({ kind: 'psalm', chapter: ch, title: `תהילים ${hebrewNumeral(ch)}` });
    } else if (b.type === 'psalm119') {
      const letters = b.letters ?? name;
      const r = groupsForName(letters);
      if (b.lettersFrom) ignored = r.ignored;
      if (r.groups.length) sections.push({ kind: 'psalm119', title: `תהילים קי״ט — אותיות ${b.letters ? '' : 'השם '}${letters}`, groups: r.groups });
    } else if (b.type === 'mishnah') {
      sections.push({ kind: 'mishnah', ref: b.ref, from: b.from, to: b.to, title: b.title });
    } else if (b.type === 'prayer') {
      const s = { kind: 'prayer', text: b.byGender && gender === 'female' ? `${b.text}-female` : b.text, title: b.title };
      if (b.needsMinyan && !hasMinyan) s.note = MINYAN_NOTE;
      if (b.fillName) s.name = name;
      sections.push(s);
    } else {
      throw new Error(`unknown block type ${b.type}`);
    }
  }
  return { template: templateId, sections, ignored };
}

// The reading lives in the link: ?n=<name>&g=m|f&minyan=1|0. Defaults: male, with a minyan.
export function inputsFromParams(params) {
  return {
    name: params.get('n')?.trim() ?? '',
    gender: params.get('g') === 'f' ? 'female' : 'male',
    hasMinyan: params.get('minyan') !== '0',
  };
}

export function paramsFromInputs({ name, gender, hasMinyan }) {
  return new URLSearchParams({ n: name, g: gender === 'female' ? 'f' : 'm', minyan: hasMinyan ? '1' : '0' });
}
