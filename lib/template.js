// Starting templates and the pure builder that turns one into an ordered reading.
// A template is data; buildOrder resolves it against the reader's inputs into sections that name
// the text to show (chapter, letter groups, mishnah range, prayer id). The site fills in the words.

import { groupsForName } from './psalm119.js';
import { hebrewNumeral } from './hebrew.js';
import { TEMPLATES } from './templates/index.js';
import { NESHAMA } from './templates/constants.js';

export { TEMPLATES, NESHAMA };


export const MINYAN_NOTE = 'נאמר במניין בלבד';

// inputs: { name, gender: 'male' | 'female', hasMinyan: boolean, parentName?: string }
// parentName is the parent the template's custom names the deceased by (template.parent: 'mother' | 'father');
// a block with withParent reads "<name> בן/בת <parentName>" when it is given, the name alone otherwise.
export function buildOrder(templateId, { name = '', gender = 'male', hasMinyan = true, parentName = '' } = {}) {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`unknown template ${templateId}`);
  const sections = [];
  let ignored = [];
  const parent = parentName.trim();
  const fullName = (withParent) => (withParent && parent ? `${name} ${gender === 'female' ? 'בת' : 'בן'} ${parent}` : name);
  for (const b of template.blocks) {
    if (b.type === 'psalms') {
      for (const ch of b.chapters) sections.push({ kind: 'psalm', chapter: ch, title: `תהילים ${hebrewNumeral(ch)}` });
    } else if (b.type === 'psalm119') {
      const letters = b.letters ?? fullName(b.withParent);
      const r = groupsForName(letters);
      if (b.lettersFrom) ignored = r.ignored;
      if (r.groups.length) sections.push({ kind: 'psalm119', title: `תהילים קי״ט — אותיות ${b.letters ? '' : 'השם '}${letters}`, groups: r.groups });
    } else if (b.type === 'mishnah') {
      sections.push({ kind: 'mishnah', ref: b.ref, from: b.from, to: b.to, title: b.title });
    } else if (b.type === 'prayer') {
      const s = { kind: 'prayer', text: b.byGender && gender === 'female' ? `${b.text}-female` : b.text, title: b.title };
      if (b.needsMinyan && !hasMinyan) s.note = MINYAN_NOTE;
      if (b.fillName) s.name = fullName(b.withParent);
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
