// morocco_base, master doc Part ג׳ and moreshetavot ("יהודי מרוקו"): יושב בסתר, Psalm 119 by the name and the
// mother's name, then by קרע שטן, Kaddish (יהא שלמא), the Neshama mishnayot, כל ישראל, Kaddish al Yisrael and
// the long Hashkava. The Kaddish is the Edot HaMizrach text; Moroccan wording differences are not yet checked.
// ויהי נועם (Psalm 90:17) opens the order, before Psalm 91, as the sources give it.
// Not yet included:
//   Zohar "אמר רבי אבא": no license-clear vowelled text found (Wikisource has it unvowelled).
import { MISHNAH_NESHAMA, KRA_SATAN, CANDIDATE } from './constants.js';

export default {
  title: 'מרוקו',
  status: CANDIDATE,
  confidence: 'medium',
  parent: 'mother',
  sources: ['moreshetavot.co.il, iluy-neshama (יהודי מרוקו)', 'master doc Part ג׳'],
  blocks: [
    { type: 'verses', chapter: 90, from: 17, to: 17, title: 'ויהי נועם (תהילים צ׳, י״ז)' },
    { type: 'psalms', chapters: [91] },
    { type: 'psalm119', lettersFrom: 'name', withParent: true },
    { type: 'psalm119', letters: KRA_SATAN },
    { type: 'prayer', text: 'kaddish-yatom-edot', title: 'קדיש יהא שלמא', needsMinyan: true },
    MISHNAH_NESHAMA,
    { type: 'prayer', text: 'kol-yisrael', title: 'כל ישראל' },
    { type: 'prayer', text: 'kaddish-derabbanan-edot', title: 'קדיש על ישראל', needsMinyan: true },
    { type: 'prayer', text: 'hashkava-long', title: 'השכבה', byGender: true, fillName: true, withParent: true },
  ],
};
