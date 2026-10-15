// Psalm 119 letter engine — name -> ordered list of 8-verse groups.
// Pure ES module shared by the site and the tests. Rules: docs/PROJECT_MASTER.md §4.2.

import { stripNikkud } from './hebrew.js';

export const ALEPH_BET = 'אבגדהוזחטיכלמנסעפצקרשת';
const FINAL_TO_REGULAR = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// Separators that are part of how names are written and carry no letter.
const SEPARATOR_RE = /[\s\-־'"׳״]/;

// Map a name to its letters, in order, repeats kept (a repeated letter repeats its group).
// Anything that is neither a Hebrew letter nor a separator is reported, never guessed at.
export function lettersOf(name) {
  const letters = [];
  const ignored = [];
  for (const ch of stripNikkud(name.normalize('NFC'))) {
    const letter = FINAL_TO_REGULAR[ch] ?? ch;
    if (ALEPH_BET.includes(letter)) letters.push(letter);
    else if (!SEPARATOR_RE.test(ch)) ignored.push(ch);
  }
  return { letters, ignored };
}

// The 8-verse section of Psalm 119 for one letter: index i -> verses 8i+1 .. 8i+8.
export function groupFor(letter) {
  const index = ALEPH_BET.indexOf(FINAL_TO_REGULAR[letter] ?? letter);
  if (index < 0) throw new Error(`Not a Hebrew letter: ${letter}`);
  return { letter: ALEPH_BET[index], index, from: 8 * index + 1, to: 8 * index + 8 };
}

export function groupsForName(name) {
  const { letters, ignored } = lettersOf(name);
  return { groups: letters.map(groupFor), ignored };
}
