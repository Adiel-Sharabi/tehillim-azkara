// The one place that names which edition each reading text is taken from (master doc,
// "החלטות ביצוע — 15.10.2026", decisions ה1 and ה2). Every edition stays in sources/ for comparison;
// changing a choice here and running `npm run build:reading` switches the reading text.
export const READING_EDITIONS = {
  mishnah: 'sefaria-torat-emet-357',
  kaddish: 'sefaria-metsudah-siddur-1981',
  elMale: 'sefaria-metsudah-machzor-yk-ashkenaz-linear',
};
