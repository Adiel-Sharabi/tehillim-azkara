# Mishnah: multi-source review (15.10.2026)

Reading edition: Torat Emet 357 (decision ה1). The record is [review.json](review.json); `lib/corrections.js` applies it
on top of `mishnah.json` without editing the import, and `tests/review.test.js` checks it.

**Result:** Torat Emet's letters agree with the other print witness everywhere except two legitimate variants. Its
vowels differ from Be'eri's only by tradition or convention, apart from one display issue, which is corrected in
4 places. **Nothing needs a human decision.** Status for Mikvaot 7 and Kelim 24 is `INDEPENDENTLY_COMPARED`; nothing
here is a proofread.

## Witnesses and independence

| witness | layer | note |
|---|---|---|
| Romm Vilna 1913 (Sefaria) | letters | independent print witness, unvowelled |
| Mechon Mamre Mishnah | letters | the Rambam's text, comparison only; read for Mikvaot 7:4–7 |
| Be'eri, Wikisource | vowels | Kaufmann-based, adapted towards the standard text |
| Be'eri–Kaufmann (Sefaria) | vowels | **same editor as the Wikisource edition**, so not an independent second vote |

Method: word-level alignment on consonant skeletons (matres lectionis ignored), marks compared after canonical
reordering, plus a scan for letters left with no vowel. 24 mishnayot, every word.

## Letters: Torat Emet vs Vilna

The only differences:

- `רַבִּי` written out where Vilna abbreviates `ר'` (6 places).
- 7:2 `מֵהֶן` / Vilna `מהם`, and Kelim 24:2 `הֵן` / Vilna `הם`. These are known print variants and both are grammatical.

Mechon Mamre differs in 7:4–7 only where the Rambam's tradition differs (`שלושת`, `הנראה`, `רגליים`). These are
not errors in Torat Emet.

## Vowels: Torat Emet vs Be'eri

Kept as Torat Emet prints them, because they are tradition or convention and not errors:

- **Kaufmann tradition in Be'eri:** `רִבִּי`, `קֻרְטוֹב`, `מִקְוָה`, `שֶׁיֵּשׁ`, `אַפִלּוּ`, `לָגִּין` / `שְׁלֹשֶׁת`.
- **Be'eri's house style:** silent sheva left unmarked (`מִקצַת`), and `לא` written without holam.
- **Torat Emet's conventions:**
  - no dagesh in בגד"כפת after a word ending in a vowel (`וְלֹא פוֹסְלִין`, `בִשְׁלשָׁה`, `כְקַתֶּדְרָא`);
  - pausal forms at the end of a clause (`כַּמָּיִם`, `הַמָּיִם`).
- **Readings where both forms are grammatical and the sense is the same:**
  - 7:5 `לְמִקְוֶה` (Be'eri `לַמִּקְוָה`): "into a mikveh" vs "into the mikveh". The two vowelled witnesses are one
    against one, since both Be'eri editions are the same editor, so the reading edition stays.
  - Kelim 24:3–4 `בַמִּדָּה` (Be'eri `בְּמִדָּה`); `הַסָּגוֹס` (Be'eri `הַסְּגוֹס`); 24:7 `פִּנְקָסִיּוֹת`; 24:11 `תּוּרְמְלִין`;
    24:7 `הָאֱפִיפוֹרִין` (hataf-segol vs hataf-patah).

The scan also found slips in **Be'eri**, not Torat Emet, which confirm Torat Emet's form there: `וַעֲשׁוּ`
(shin dot for sin), `יַעֲשֶה` (no sin dot), `וּמחַל` (no holam), `שְׁהִיא`, `זקֵנָה`.

## Corrections applied (review.json)

| ref | Torat Emet | reading | why |
|---|---|---|---|
| Mikvaot 7:2 (×1), 7:3 (×1), 7:5 (×2) | `שְׁלשָׁה` | `שְׁלֹשָׁה` | Torat Emet prints the lamed's holam merged with the dot of the next shin, an old typesetting habit. In Unicode the lamed is left with no vowel. The same edition writes `שְׁלֹשָׁה`, with the same byte order, 6 times in Kelim 24; Be'eri and Kaufmann agree. |

Letters are unchanged by every correction; the test checks this.
