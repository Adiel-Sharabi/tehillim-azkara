// sefard_base: nusach Sefard (Chassidic). The sources treat Sefard with Ashkenaz (kadisha.org's "אשכנזי",
// moreshetavot's "ספרד–אשכנז"): seven psalms, Psalm 119 by the name and by נשמה, Kaddish Yatom, the Neshama
// mishnayot, Kaddish DeRabbanan after the learning, El Male Rachamim. The Kaddish is in nusach Sefard.
import { SEVEN_PSALMS, PSALM119_NESHAMA, MISHNAH_NESHAMA, CANDIDATE } from './constants.js';

export default {
  title: 'ספרד (חסידי)',
  summary: 'כמו אשכנז, עם קדיש בנוסח ספרד (ויצמח פורקניה) וקדיש דרבנן',
  status: CANDIDATE,
  confidence: 'medium',
  sources: ['moreshetavot.co.il, iluy-neshama (ספרד–אשכנז)', 'kadisha.org/prayers-by-name (נוסח אשכנזי)'],
  blocks: [
    SEVEN_PSALMS,
    { type: 'psalm119', lettersFrom: 'name' },
    PSALM119_NESHAMA,
    { type: 'prayer', text: 'kaddish-yatom-sefard', title: 'קדיש יתום', needsMinyan: true },
    MISHNAH_NESHAMA,
    { type: 'prayer', text: 'kaddish-derabbanan-sefard', title: 'קדיש דרבנן', needsMinyan: true },
    { type: 'prayer', text: 'el-male-rachamim', title: 'א\u05BEל מלא רחמים', byGender: true, fillName: true, withParent: true },
  ],
};
