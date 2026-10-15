// yemen_baladi_base: LOW confidence. No source describing a Yemenite azkara order was found (master doc §2.6
// says the same), so this is the order shared by the other customs, read in the Yemenite Baladi nusach:
// Psalm 119 by the name and by נשמה, Kaddish, the Neshama mishnayot, Kaddish DeRabbanan, Hashkava.
// The texts are Yemenite (Wikisource, Baladi siddur); the ORDER must be confirmed with the community.
import { PSALM119_NESHAMA, MISHNAH_NESHAMA, CANDIDATE } from './constants.js';

export default {
  title: 'תימן (בלדי)',
  summary: 'קי״ט לפי השם ונשמה, משניות נשמה, קדיש בנוסח תימן, השכבה בנוסח תימן',
  status: `${CANDIDATE}; סדר האזכרה התימני לא נמצא במקור, הסדר כאן כללי`,
  confidence: 'low',
  sources: ['he.wikisource.org "סידור/נוסח תימן בלדי/מספדות והצדקת הדין" (השכבה)', 'he.wikisource.org "קדיש יתום", "קדיש דרבנן" (נוסח=בלדי)'],
  blocks: [
    { type: 'psalm119', lettersFrom: 'name' },
    PSALM119_NESHAMA,
    { type: 'prayer', text: 'kaddish-yatom-baladi', title: 'קדיש', needsMinyan: true },
    MISHNAH_NESHAMA,
    { type: 'prayer', text: 'kaddish-derabbanan-baladi', title: 'קדיש דרבנן', needsMinyan: true },
    { type: 'prayer', text: 'hashkava-baladi', title: 'השכבה', byGender: true, fillName: true, withParent: true },
  ],
};
