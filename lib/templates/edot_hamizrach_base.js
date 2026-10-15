// edot_hamizrach_base, master doc Part ג׳, checked against moreshetavot ("עדות המזרח") and the Wikisource
// order "סדר לימוד בבית הנפטר": Psalm 119 by the name and the mother's name, then by נשמה, Kaddish (יהא שלמא),
// the Neshama mishnayot, Kaddish al Yisrael, and the short Hashkava.
// Not included, because no license-clear vowelled text was found: the יהי רצון before and after the learning.
// Kelim 24 is in the sources' order but optional in the master doc, so it is offered, not default.
import { PSALM119_NESHAMA, MISHNAH_NESHAMA, MISHNAH_KELIM_24, SEVEN_PSALMS, CANDIDATE } from './constants.js';

export default {
  title: 'עדות המזרח',
  status: CANDIDATE,
  confidence: 'medium',
  parent: 'mother',
  sources: ['moreshetavot.co.il, iluy-neshama (עדות המזרח)', 'kadisha.org/prayers-by-name (נוסח מזרחי)', 'he.wikisource.org "סדר לימוד בבית הנפטר"', 'master doc Part ג׳'],
  blocks: [
    { type: 'psalm119', lettersFrom: 'name', withParent: true },
    PSALM119_NESHAMA,
    { type: 'prayer', text: 'kaddish-yatom-edot', title: 'קדיש יהא שלמא', needsMinyan: true },
    MISHNAH_NESHAMA,
    { type: 'prayer', text: 'kaddish-derabbanan-edot', title: 'קדיש על ישראל', needsMinyan: true },
    { type: 'prayer', text: 'hashkava', title: 'השכבה', byGender: true, fillName: true, withParent: true },
  ],
  optional: [MISHNAH_KELIM_24, SEVEN_PSALMS, { type: 'prayer', text: 'hashkava-long', title: 'השכבה (נוסח ארוך)', byGender: true, fillName: true, withParent: true }],
};
