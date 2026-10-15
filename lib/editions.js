// The one place that names which edition each reading text is taken from (master doc,
// "החלטות ביצוע — 15.10.2026", decisions ה1 and ה2, and the customs added for issue #5).
// Every edition stays in sources/ for comparison; changing a choice here and running
// `npm run build:reading` switches the reading text.
//
// Keys are roles; READING_TEXTS (below) says which texts each role supplies.
export const READING_EDITIONS = {
  mishnah: 'sefaria-torat-emet-357',
  kaddish: 'sefaria-metsudah-siddur-1981',
  elMale: 'sefaria-metsudah-machzor-yk-ashkenaz-linear',
  // Nusach Sefard (Chassidic): Metsudah Siddur Sefard. Witnesses: Wikisource (נוסח=ספרד).
  kaddishSefard: 'sefaria-metsudah-siddur-sefard-1981',
  // Edot HaMizrach (also read for Morocco): the CC0 Shaliehsaboo text agrees with Torat Emet word for word
  // (spelling aside) and fixes its digitisation slips. Witnesses: Torat Emet 357, Wikisource (נוסח=מזרח).
  kaddishEdot: 'sefaria-shaliehsaboo-edot',
  // Yemenite Baladi: the only license-clear vowelled source found. Comparison: Hamichlol "חצי קדיש" (not copied).
  kaddishBaladi: 'wikisource-kaddish-nusachim',
  // Sephardic Hashkava, short and long, man and woman: Torat Emet 357 (complete; missing points completed
  // from witnesses, logged). Witnesses: Wikisource "השכבה", Shaliehsaboo (short form only).
  hashkava: 'sefaria-torat-emet-357-edot',
  hashkavaBaladi: 'wikisource-siddur-baladi',
  kolYisrael: 'sefaria-torat-emet-357-sanhedrin',
};

// Which prayer texts each role supplies to the reading library.
export const READING_TEXTS = {
  kaddish: ['kaddish-yatom', 'kaddish-derabbanan'],
  elMale: ['el-male-rachamim', 'el-male-rachamim-female'],
  kaddishSefard: ['kaddish-yatom-sefard', 'kaddish-derabbanan-sefard'],
  kaddishEdot: ['kaddish-yatom-edot', 'kaddish-derabbanan-edot'],
  kaddishBaladi: ['kaddish-yatom-baladi', 'kaddish-derabbanan-baladi'],
  hashkava: ['hashkava', 'hashkava-female', 'hashkava-long', 'hashkava-long-female'],
  hashkavaBaladi: ['hashkava-baladi', 'hashkava-baladi-female'],
  kolYisrael: ['kol-yisrael'],
};

// Mishnah chapters the templates read (whole chapters; a template picks the range).
export const READING_MISHNAH = ['Mikvaot.7', 'Kelim.24'];
