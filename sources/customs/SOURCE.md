# Texts for the Sefard, Edot HaMizrach, Morocco and Yemen templates

Built by `node scripts/import-customs.mjs` (`--offline` rebuilds from `raw/`, `--relock` accepts upstream
changes). Which edition is *read* is set in `lib/editions.js`; every other edition here is a witness.
`diff-report.json` holds the word-level consonant comparison of every text across editions and every
pointing completion. Nothing here is proofread by a person.

## Editions

| id | what | license | role |
|---|---|---|---|
| `sefaria-metsudah-siddur-sefard-1981` | Metsudah Siddur, nusach Sefard (1981), via Sefaria | CC-BY (attribution: Metsudah Publications / Avrohom Davis) | **reading**: Kaddish Yatom, Kaddish DeRabbanan (Sefard) |
| `sefaria-shaliehsaboo-edot` | Siddur Edot HaMizrach, "Shaliehsaboo Edition", via Sefaria | CC0 | **reading**: Kaddish Yatom (יהא שלמא), Kaddish al Yisrael (Edot HaMizrach; also Morocco) |
| `sefaria-torat-emet-357-edot` | Siddur Edot HaMizrach, Torat Emet 357, via Sefaria | Public Domain | **reading**: Hashkava, short and long, man and woman; witness for the Kaddish |
| `sefaria-torat-emet-357-sanhedrin` | Mishnah Sanhedrin 10:1, Torat Emet 357 | Public Domain | **reading**: כל ישראל |
| `sefaria-romm-vilna-1913-sanhedrin` | Mishnah Sanhedrin 10:1, Romm Vilna 1913 (unvowelled) | Public Domain | witness |
| `wikisource-kaddish-nusachim` | Hebrew Wikisource "קדיש יתום" (rev 3000471), "חצי קדיש" (3000469), "קדיש דרבנן" (3000510), rendered with נוסח=ספרד / מזרח / בלדי | CC BY-SA 4.0 | **reading**: Yemenite Baladi Kaddish; witness for Sefard and Edot |
| `wikisource-hashkava` | Hebrew Wikisource "השכבה", rev 3020102 | CC BY-SA 4.0 | witness for the Hashkava |
| `wikisource-siddur-baladi` | Hebrew Wikisource "סידור/נוסח תימן בלדי/מספדות והצדקת הדין", rev 3081604 | CC BY-SA 4.0 | **reading**: Yemenite Hashkava |

CC BY-SA texts require attribution (page title, revision link, the page history for contributors) and
share-alike for adapted text; CC-BY requires attribution. The site footer must credit them.

## Comparison verdicts

Each reading text was compared word by word (consonants) with every other edition holding it.

- **Edot HaMizrach Kaddish.** Shaliehsaboo and Torat Emet are word-for-word identical except two spellings
  (וּגְאוּלָה/וּגְאֻלָּה, וְרֶוַח/וְרֵיוַח). Shaliehsaboo is derived from Torat Emet and fixes its slips (Torat Emet
  has a stray sheva in בִּרְכָתָא ְשִׁירָתָא). Wikisource (independent) differs only in accepted variants:
  it lacks וּגְאֻלָּה and עַמּוֹ in יהא שלמא, and has "קֳדָם אֱלָהָא מָארֵה" for "קֳדָם מָארֵי". Reading: Shaliehsaboo.
- **Sefard Kaddish.** Metsudah and Wikisource agree except: (קֵץ) (optional, Metsudah only); Kaddish DeRabbanan
  "וְרַחֲמִין וְחַיִּין אֲרִיכִין וּמְזוֹנָא" (Metsudah) vs "וְרַחֲמֵי וְחַיֵּי אֲרִיכֵי וּמְזוֹנֵי" (Wikisource), both known;
  **Kaddish Yatom "וְחַיִּים עָלֵינוּ" (Metsudah) vs "וְחַיִּים טוֹבִים עָלֵינוּ" (Wikisource, and the Chabad siddur
  on Sefaria)**. Both wordings are in use; Metsudah is kept as printed. Worth confirming with a nusach-Sefard
  community.
- **Yemenite Kaddish.** Wikisource is the only license-clear vowelled source found. Checked against the
  Yemenite variants the Hamichlol article "חצי קדיש" lists (comparison only, not copied): all present
  (וְיִמְלוֹךְ, וְיִפְרוֹק עַמֵּיהּ, וּבְחַיֵּיהוֹן, the order וְיִתְעַלֶּה וְיִתְהַדַּר וְיִתְהַלַּל וְיִתְנַשֵּׂא, לְעֵילָא לְעֵילָא מִכָּל,
  וְסִייַּעְתָּא ... לְחַיִים וּלְשָׁלוֹם). One difference: Hamichlol "וְעַל כָּל קְהָלְהוֹן דְּכָל בֵּית יִשְׂרָאֵל" where
  Wikisource has "וְעַל כָּל יִשְׂרָאֵל". A test pins the variants.
- **Hashkava (Edot HaMizrach).** Torat Emet is the only edition with all four forms. Its wording agrees
  with Wikisource except "שֶׁל הַנִּפְטַר בְּשֵׁם טוֹב מִן הָעוֹלָם" (Torat Emet) vs "שֶׁל הַשֵּׁם הַטּוֹב" (Wikisource), and in the
  long forms several Aramaic spellings and small additions (הַמְרוּחָם, עָלָיו, בְּרַחֲמָיו). In the short form for
  a woman, Wikisource's masculine "בְּנֵי ... הַשּׁוֹכְבִים עִמּוֹ" is an error; Torat Emet and the Yemenite
  text both have "בְּנוֹת ... הַשּׁוֹכְבוֹת עִמָּהּ".
  Torat Emet leaves some words partly unpointed; 12 were completed from witnesses (listed in
  `diff-report.json` under `completions`; vowels only, never a changed letter or mark). Still unpointed or
  doubtful, left as printed: בּגַן and דּאִתְפְּטָר (long, man: dagesh without sheva), וּבְמֵימרֵיהּ, דּוּכרָן,
  מִשְׁכָּבָה (no mappiq) in the long form for a woman.
- **כל ישראל.** Torat Emet and Vilna agree except spellings (כֻּלָּם/כולם, מַעֲשֵׂה/מעשי).
- **Yemenite Hashkava.** Single license-clear source. Its core (מְנוּחָה נְכוֹנָה ..., רַחֲמָנָא דִּי רַחֲמָנוּתָא ...)
  matches the Sephardic long Hashkava in substance, with Yemenite wording.

## Not imported, and why

- **יהי רצון before and after learning** (Edot HaMizrach order): only unvowelled texts found (Wikisource
  "סדר לימוד בבית הנפטר"). SOURCE_PENDING.
- **Zohar "אמר רבי אבא"** (Morocco): Wikisource has it unvowelled only. SOURCE_PENDING.
- **ויהי נועם, Psalm 90:17** (Morocco): needs Psalm 90 added to the MAM import and the UXLC collation.
- **Ten Days of Repentance wording** (לְעֵילָּא וּלְעֵילָּא, הַשָּׁלוֹם): instruction segments, dropped as in Ashkenaz.
- **Kaddish for Morocco in Moroccan wording**: the Edot HaMizrach text is read; Moroccan differences unchecked.
