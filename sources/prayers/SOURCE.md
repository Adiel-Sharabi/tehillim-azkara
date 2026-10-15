# Prayers: Kaddish Yatom, Kaddish DeRabbanan, El Male Rachamim (nusach Ashkenaz)

Status of everything here: **`IMPORTED`**. Nothing is proofread (`PROOFREAD` is never set by the importer). Each text was
checked mechanically (structure, vowelling, version/licence guards) and compared edition-to-edition at consonant level;
no person has read it against a printed siddur.

Output: `sources/prayers/prayers.json` (editions -> texts -> `[{role, text, ...}]`).
Importer: `scripts/import-prayers.mjs`. Version lock: `sources/prayers/prayers.lock.json` (tracked).
Consonant diff of the editions: `sources/prayers/diff-report.json`. Raw responses: `sources/prayers/raw/` (gitignored,
with `manifest.json` = URL + sha256 + retrieval time per file).

Retrieved 2026-10-15. The site never calls any of these APIs at runtime.

## Editions imported

| edition id | texts | source | version (passed explicitly) | licence |
|---|---|---|---|---|
| `sefaria-daat-siddur-ashkenaz` | kaddish-yatom, kaddish-derabbanan | Sefaria `Siddur Ashkenaz, Kaddish, Mourner's Kaddish` and `..., Kaddish d'Rabbanan` | `Daat Siddur Ashkenaz` (upstream: http://www.daat.ac.il/daat/sidurim/tohen3.htm) | Public Domain (Sefaria label), https://en.wikipedia.org/wiki/Public_domain |
| `sefaria-metsudah-siddur-1981` | kaddish-yatom, kaddish-derabbanan | Sefaria `Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Mourner's Kaddish` and `..., Preparatory Prayers, Korbanot, Kaddish DeRabbanan` | `The Metsudah siddur, 1981` (upstream: https://www.nli.org.il/he/books/NNL_ALEPH002211687) | CC-BY, https://creativecommons.org/licenses/by/3.0/ |
| `sefaria-metsudah-machzor-yk-ashkenaz-linear` | el-male-rachamim (man), el-male-rachamim-female | Sefaria `Machzor Yom Kippur Ashkenaz Linear, Memorial Services` segments 72-93 (man) and 95-117 (woman) | `The Metsudah Machzor. Metsudah Publications, New York` (upstream: https://www.nli.org.il/he/books/NNL_ALEPH000996925) | CC-BY, https://creativecommons.org/licenses/by/3.0/ |
| `wikisource-he-el-male-rachamim` (**fallback**) | el-male-rachamim, el-male-rachamim-female | Hebrew Wikisource page `אל מלא רחמים`, sections לנפטר / לנפטרת, **revision 3007226** (2026-04-21T09:43:14Z, latest at retrieval) | n/a (MediaWiki `action=parse&oldid=3007226`) | CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ |

Sefaria licence URLs are Sefaria's own mapping (Sefaria-Project `static/js/sefaria/sefaria.js`); the version number of the
CC-BY licence is whatever that mapping says (3.0), Sefaria's data does not state it per version.
Sefaria content hashes (sha256 of `JSON.stringify(version.text)`) are in `prayers.lock.json` and in each edition's
`source.payloadSha256`; a changed upstream text aborts the importer until `--relock`.

## Why these, and what was rejected

* **Never Sefaria's default version.** Every request is `?version=hebrew|<exact versionTitle>`; the importer asserts that exactly one version comes back, with that title and that licence.
* Allowed licences (checked against the `license` field of `/api/texts/versions/<index>`): Public Domain, CC0, CC-BY, CC-BY-SA. Anything else throws.
* **Rejected, licence not clear or not allowed:** `Torat Emet 357` (licence `unknown`; it is the Siddur Sefard text), Sefaria's `Yizkor` work whose version is *titled* "Public Domain" (its `license` field is `unknown`; its declared source is he.wikipedia), `Weekday Siddur Chabad` / Wikisource-via-Sefaria (`unknown`, and nusach Ari), `Machzor Yom Kippur Ashkenaz` paragraph edition of Metsudah (`unknown`), Koren Shalem Siddur (`CC-BY-NC`; the Koren machzor was not checked separately).
* The other two Hebrew Metsudah versions in `Siddur Ashkenaz` ("The Metsudah siddur: a new linear siddur ... 1981", also CC-BY) were not used; one Metsudah edition is enough.

## Where each prayer is

* **Kaddish Yatom and Kaddish DeRabbanan**: two license-clear editions, Daat (stand-alone `Kaddish` section) and Metsudah (under the weekday Shacharit refs, identical across Maariv, Minchah and Pesukei Dezimra; Kabbalat Shabbat has the same words in one paragraph).
* **El Male Rachamim: NOT in `Siddur Ashkenaz` on Sefaria in any version** (that siddur has only Av HaRachamim). The license-clear Ashkenaz source found is the Metsudah Yom Kippur machzor's Memorial Services; the Hebrew Wikisource page is the second, labelled fallback. Sefaria's other El Male carriers are Sefard/Edot HaMizrach (Torat Emet 357, unknown licence) or non-commercial (Koren).
* The machzor section is the Yom Kippur Yizkor service, so the text is the memorial wording ("בעבור שנדבו צדקה"). It is the same El Male the Ashkenaz siddur prints; the only Yom Kippur context is the section it sits in.

## Vowelling (checked: Hebrew points U+05B0-U+05BC, U+05C1/U+05C2)

| edition / text | words | words with no nikkud | notes |
|---|---|---|---|
| Daat, kaddish-yatom | 82 | 7 | only the congregation responses (אמן x5 incl. repeats, בריך הוא) are unpointed. **The pointing is incomplete elsewhere:** 6 shin/sin without dot (יִשרָאֵל x3, וְיִתְנַשּא, עוֹשה, יַעֲשה) and 4 words with a bare vav instead of holam (בְּחַיֵּיכון, וְיִתְרומַם, בִּמְרומָיו, שָׁלום). |
| Daat, kaddish-derabbanan | 134 | 9 | congregation responses unpointed, and a stray unpointed duplicate `בריך הוא` in the reader text (`בְּרִיךְ הוּא. בריך הוא.`). Otherwise fully pointed. |
| Metsudah, kaddish-yatom / -derabbanan | 76 / 118 | 0 / 0 | fully pointed, responses included. |
| Metsudah machzor, El Male (man / woman) | 52 / 52 | 0 / 0 | fully pointed. |
| Wikisource, El Male (man / woman) | 52 / 52 | 0 / 0 | fully pointed. |

Consequence: **Metsudah is the better base for the display**, Daat is the cross-check (and its Kaddish Yatom should not be shown as-is).

Marks other than plain vowels, kept exactly as the source has them: Metsudah Kaddish Yatom has U+0592 (a sheva-na marker, 5 times, e.g. `בְּעָלְ֒מָֽא`) and U+05BD meteg (12 times); the El Male texts have U+05BD. A display layer may want to drop U+0592. The Metsudah machzor prints the Tetragrammaton fully pointed (`יְהֹוָה`, once per El Male); Wikisource writes `יְיָ`. The importer does not touch either.

## Roles: how congregation responses were decided

Roles are `leader` (the person reciting; for Kaddish the mourner/reader), `congregation`, `instruction`. A segment is
`congregation` **only where the source itself marks it**; nothing is inferred from liturgical knowledge.

* **Daat**: a bracketed group `[...]` is congregation (the Mourner's Kaddish writes it as `[קהל: אמן]`, the Rabbanan text as bare `[אמן]`, which is the same convention). An explicit label `קהל:` / `קהל ואבל:` / `אבל:` switches the role for the rest of the line; `קהל ואבל:` (congregation and mourner together) becomes `congregation` with `together: true`. Unmarked text is `leader`. Daat's Rabbanan text does NOT label `יהא שמה רבא` as a joint response in the main line (it only appears bracketed in the response before it), so the main-line `יהא שמה רבא ...` stays `leader`.
* **Metsudah**: bold is the marker. A bold run is `congregation` when its consonants are exactly `אמן`, `בריך הוא` or `יהא שמה רבא מברך לעלם ולעלמי עלמיא`; the first Amen of a paragraph is also in parentheses, which are dropped (the role carries it). The bold *opening word* `יִתְגַּדַּל` is an incipit marker (Metsudah bolds the first word of Av HaRachamim and Ashrei the same way), not a response, and stays `leader`. Any other bold run throws. **Caveat:** Sefaria gives no legend for the bold, so "bold = congregation" is inferred from what is bold in these two prayers, and is consistent with every instance.
* The reader's own "ואמרו אמן" is kept in the `leader` text in Daat (the word is in the source line) and ends at "ואמרו" in Metsudah, where the bold Amen is the response. Trailing sof-pasuq punctuation after a response stays with the response (`אָמֵן:`).
* Aseret Yemei Teshuva alternates, in both sources, are `instruction` segments (Metsudah keeps its parentheses: `(בעשי"ת הַשָּׁלוֹם)`; Daat: `בעשי”ת: הַשָּׁלום`). The explanatory note at the head of Metsudah's Kaddish DeRabbanan (why Kaddish is in Aramaic) is one `instruction` segment. The optional `(וְאַרְעָא)` in Rabbanan stays in the reader text.
* El Male (both editions): the source marks no responses, so every segment is `leader`; the only other roles used are `instruction` (Wikisource's `(נ״א: יַסְתִּירָהּ)` alternative reading for the woman).
* Whitespace is collapsed and ends are trimmed; HTML tags and the bracket/paren/label delimiters that carry the role are removed; everything else is as the source has it. Importer sanity checks: exact number of congregation segments per Kaddish (Daat 7/7, Metsudah 7/8) so a changed upstream layout fails loudly.

## Name slot and male/female forms (El Male)

* **Metsudah machzor**: its own line `(פב"פ)` (ASCII `"`), between `אֶת נִשְׁמַת` and `שֶׁהָלַךְ לְעוֹלָמוֹ`; abbreviation of פלוני בן פלוני. The woman's paragraph uses the **same** `(פב"פ)`; only the wording around it changes (שֶׁהָלְכָה לְעוֹלָמָהּ, נִשְׁמָתָהּ, מְנוּחָתָהּ, יַסְתִּירֶֽהָ, נַחֲלָתָהּ, וְתָנֽוּחַ, מִשְׁכָּבָהּ).
* **Wikisource**: wiki template `{{פבפ|ז|ז}}` renders as `שם בֶּן שם האב` (man) and `שם בַּת שם האב` (woman); the grey `שם` / `שם האב` are the placeholders.
* In `prayers.json` the slot is one segment with `slot: "name"` (`text` is the source's own marker, to be replaced by the name). Man = key `el-male-rachamim`, woman = key `el-male-rachamim-female`. A name for a woman would be `פלונית בת פלוני`-style (name + בת + father's name); neither source prints that, so it is a decision for the site, not data from the source.

## Consonant-level comparison (marks U+0591-U+05C7 stripped, maqaf = space, punctuation dropped, the word אמן ignored)

Full list in `diff-report.json`. Summary:

* **kaddish-yatom, Daat vs Metsudah**: one difference, Daat `דקדשא בריך הוא` vs Metsudah `דקודשא` (spelling דְּקֻדְשָׁא / דְקוּדְשָׁא, and Daat's reader also says `בריך הוא` while Metsudah prints it only as the bold response).
* **kaddish-derabbanan**: Daat prints the bracketed response `אמן, יהא שמה רבא ...` and then repeats `יהא שמה רבא ...` in the main line (Metsudah: once); the same `דקדשא` difference; Daat has `קדישא` (`דִּי בְאַתְרָא קַדִּישָׁא הָדֵין`) which Metsudah lacks; `ומזוני` / `ומזונא` and `ופרקנא` / `ופורקנא` (spelling). A real nusach variant to settle: **קדישא**.
* **El Male, Metsudah vs Wikisource**: `ויצרור` / `ויצרר` (spelling); `יהוה` / `יי` (how the Name is written); word order `וְיָנוּחַ עַל מִשְׁכָּבוֹ בְּשָׁלוֹם` (Metsudah) vs `וְיָנוּחַ בְּשָׁלוֹם עַל מִשְׁכָּבוֹ` (Wikisource), same in the woman's form. Woman only: `כזהר` / `כזוהר`. Otherwise identical on 51 words, including `עַל כַּנְפֵי` (not `תַּחַת`) and `שֶׁנָּדְבוּ צְדָקָה`.

## Attribution to carry onto the site

* Metsudah texts (CC-BY): credit *The Metsudah Siddur / Machzor, Metsudah Publications*, with the Sefaria page and licence link; state that the text was reformatted (roles, placeholders).
* Wikisource El Male (CC BY-SA 4.0, share-alike): credit "Hebrew Wikisource, page אל מלא רחמים, revision 3007226" with the page history link (`source.historyUrl`); registered contributors are listed in `source.contributors`, the 11 anonymous editors are counted only (their IP addresses are deliberately not stored in tracked files). Any adaptation of that text must be shared under the same licence.
* Daat (Public Domain per Sefaria's label): no attribution required; keep the Sefaria/daat.ac.il pointers anyway.

## Gaps / not done

* **No nusach Sefard, Edot HaMizrach, Chabad or Teiman** in this import (not asked); all texts here are Ashkenaz.
* **No PROOFREAD**, no comparison against a printed siddur. Both Metsudah and the Wikisource page should be read against a printed Ashkenaz siddur before anything is marked past `IMPORTED`.
* **El Male variants not imported**: Wikisource sections for IDF fallen, Shoah victims (two alternative wordings), and the "Yizkor" paragraphs and Av HaRachamim in the machzor section. Mourner-specific variants (e.g. for several people, for a child, plural forms) are not in either source.
* **Name slot for the woman** (see above) and **how to render the Tetragrammaton** are display decisions.
* **No Kaddish text with the Yom Tov / Aseret Yemei Teshuva wording selected**: both forms are in the data (the alternates are `instruction` segments), the site must choose.
* The Daat Kaddish Yatom is only partially pointed (see the table); do not use it as the display base.
* The `Machzor Yom Kippur Ashkenaz Linear` slice numbers (72-93, 95-117) are pinned and asserted (text must start with `אל מלא רחמים` and end with `ונאמר אמן`, one name slot, man/woman wording); if Sefaria renumbers that section the importer fails rather than guessing.
* No automated test in `tests/` yet (this task was limited to `scripts/` and `sources/prayers/`); the importer's own assertions are the gate. A test that runs `--offline` against a committed fixture would be the next step.

## Regenerate

```
node scripts/import-prayers.mjs             # fetch + build (aborts if upstream text changed from the lock)
node scripts/import-prayers.mjs --offline   # rebuild from sources/prayers/raw (sha256-verified), no network
node scripts/import-prayers.mjs --relock    # accept changed upstream text and rewrite prayers.lock.json
```
