// ashkenaz_base, master doc Part ג׳. psalms_7 keeps the order of its refs there.
// Custom status: candidate, not yet confirmed with a rabbi or community.
import { NESHAMA } from './constants.js';

export default {
  title: 'אשכנז',
  blocks: [
    { type: 'psalms', chapters: [33, 16, 17, 72, 91, 104, 130] },
    { type: 'psalm119', lettersFrom: 'name' },
    { type: 'psalm119', letters: NESHAMA },
    { type: 'mishnah', ref: 'Mikvaot.7', from: 4, to: 7, title: 'משניות מקוואות פרק ז׳, משניות ד׳–ז׳ (נשמה)' },
    { type: 'prayer', text: 'kaddish-yatom', title: 'קדיש יתום', needsMinyan: true },
    { type: 'prayer', text: 'el-male-rachamim', title: 'א\u05BEל מלא רחמים', byGender: true, fillName: true },
  ],
};
