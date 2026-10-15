# Prayers (Ashkenaz): multi-source review (15.10.2026)

Reading editions:
- Kaddish Yatom and Kaddish DeRabbanan: Metsudah Siddur 1981.
- El Male Rachamim: Metsudah Yom Kippur Machzor (decision ה2).

The record is [review.json](review.json). `lib/corrections.js` applies it on top of `prayers.json`, and
`tests/review.test.js` checks it.

**Result:** 3 corrections (one structural, applied in 9 places; one wording error). Every other difference is a
legitimate Ashkenaz variant and is kept. **Nothing needs a human decision.** Status is `INDEPENDENTLY_COMPARED`
for the two Metsudah editions; nothing here is a proofread.

## Witnesses

| witness | texts | use |
|---|---|---|
| Daat Siddur Ashkenaz (Sefaria, PD) | both Kaddishes | already in the library |
| Wikisource El Male Rachamim (revid 3007226) | El Male | already in the library |
| Birnbaum, *Ha-Siddur ha-Shalem* 1949, on Wikisource (revids 1405733, 1425880) | Kaddish, הזכרת נשמות | comparison only |
| Wikisource סידור/נוסח אשכנז: קדיש (3077440), הזכרת נשמות (3088158) | Kaddish, El Male | comparison only |
| Wikisource קדיש דרבנן (3000510), תפילות ומזמורים לבית קברות (3020137) | Kaddish DeRabbanan, El Male | comparison only |
| Chevra Kadisha Rishon LeZion, hkr.org.il | El Male (man, woman) | comparison only |

kadisha.org could not be fetched: the TLS chain was rejected. Sefaria's search API returned nothing for any query,
so it was not used.

## Corrections applied

1. **The reciter's "אמן" (both Kaddishes; 4 places in Yatom, 5 in DeRabbanan).**
   - Metsudah prints `וְאִמְרוּ` in plain type and `אָמֵן` in bold, and bold marks the congregation. So the import
     gave the word to the congregation only, and the person saying Kaddish would read `וְאִמְרוּ` and stop.
   - In every witness the reciter says `וְאִמְרוּ אָמֵן` and the congregation answers `אָמֵן`. The reciter's line now
     ends `וְאִמְרוּ אָמֵן`, and the congregation response stays.
2. **Kaddish DeRabbanan `וּמְזוֹנָא רְוִיחֵי` → `וּמְזוֹנֵי רְוִיחֵי`.**
   - Metsudah's form pairs a singular noun with a plural adjective.
   - Daat, Birnbaum, Wikisource's Ashkenaz siddur and Wikisource's Kaddish DeRabbanan all have `וּמְזוֹנֵי רְוִיחֵי`.
   - Birnbaum also notes the singular pair `וּמְזוֹנָא רְוִיחָא`; the mixed form is attested nowhere.

## Kept: legitimate variants

- **Kaddish:**
  - `דְקוּדְשָׁא` (others `דְּקֻדְשָׁא`; the same sound);
  - `וְנֶחָמָתָא` (Birnbaum and Daat `וְנֶחֱמָתָא`);
  - `מָאן` (others `מַאן`);
  - `דְבִשְׁמַיָּא (וְאַרְעָא)` (Wikisource `דִּי בִשְׁמַיָּא`; Birnbaum and Daat `דְּבִשְׁמַיָּא וְאַרְעָא`);
  - no `קַדִּישָׁא` in `דִּי בְאַתְרָא הָדֵין` (Daat has it).
- **El Male, word order:** Metsudah `וְיָנוּחַ עַל מִשְׁכָּבוֹ בְּשָׁלוֹם` agrees with Birnbaum. Wikisource (three pages)
  and hkr.org.il have `וְיָנוּחַ בְּשָׁלוֹם עַל מִשְׁכָּבוֹ`. Both orders are printed Ashkenaz tradition. The one more
  common in Israel today is `בְּשָׁלוֹם עַל מִשְׁכָּבוֹ`, which is worth asking about in the custom review with people.
- **El Male, the charity clause:**
  - Metsudah and hkr.org.il have `בַּעֲבוּר שֶׁנָּדְבוּ צְדָקָה` ("because they pledged charity"), the communal form.
  - Birnbaum (`שֶׁאֲנִי נוֹדֵר`) and Wikisource (`שֶׁבְּלִי נֶדֶר אֶתֵּן`) give the first-person Yizkor form.
  - Which one an azkara uses is a custom question, not a text error.
- **Spelling:** `וְיִצְרוֹר` (Wikisource `וְיִצְרֹר`) and `כְּזֹהַר` (hkr `כְּזוֹהַר`).

## Found, outside this review's scope

Metsudah uses U+0592 to mark a vocal sheva (`בְּעָלְ֒מָא`). It is not a cantillation mark here. The reading
build's "with cantillation" form keeps it, so it would show as a stray accent in that display mode.
