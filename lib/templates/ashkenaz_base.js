// ashkenaz_base, master doc Part ג׳. psalms_7 keeps the order of its refs there.
import { SEVEN_PSALMS, PSALM119_NESHAMA, MISHNAH_NESHAMA, CANDIDATE } from './constants.js';

export default {
  title: 'אשכנז',
  status: CANDIDATE,
  confidence: 'medium',
  sources: ['kadisha.org/prayers-by-name (נוסח אשכנזי)', 'moreshetavot.co.il, iluy-neshama (ספרד–אשכנז)', 'master doc Part ג׳'],
  blocks: [
    SEVEN_PSALMS,
    { type: 'psalm119', lettersFrom: 'name' },
    PSALM119_NESHAMA,
    MISHNAH_NESHAMA,
    { type: 'prayer', text: 'kaddish-yatom', title: 'קדיש יתום', needsMinyan: true },
    { type: 'prayer', text: 'el-male-rachamim', title: 'א\u05BEל מלא רחמים', byGender: true, fillName: true },
  ],
  optional: [{ type: 'prayer', text: 'kaddish-derabbanan', title: 'קדיש דרבנן', needsMinyan: true }],
};
