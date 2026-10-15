# Psalms: multi-source review (15.10.2026)

The reading text is MAM. This file explains the verdicts in [review.json](review.json), which is the record;
the tests in `tests/review.test.js` check that every difference in [COLLATION.md](COLLATION.md) has exactly one verdict.

**Result: 12 of 12 differences keep MAM. No corrections. Nothing needs a human decision.** (Psalm 90 was added for the Moroccan ויהי נועם; its one difference, 90:8, is a ketiv/qere that is read the same.)
Status: `INDEPENDENTLY_COMPARED` for letters and vowels in Psalms 16, 17, 33, 72, 91, 104, 119 and 130.
Cantillation marks were not compared, and nothing here is a proofread.

## Witnesses

| witness | what it is | how it was used |
|---|---|---|
| UXLC 2.5 | Leningrad Codex, tanach.us | all 320 verses, letter and vowel collation (`scripts/collate-psalms.mjs`) |
| MAM documentation | `MAM-parsed/plus/D1-Psalms.json` in bdenckla/MAM-basics, git blob `acba1c374cfa6dac85c7fee1136ccb9de616a788`; its `נוסח` notes record where the manuscripts differ | 41 notes in these chapters, read for every differing verse |
| Breuer | the Breuer text as published by Mechon Mamre (`mechon-mamre.org/c/ct/c26xx.htm`) | the 12 differing words; comparison only, nothing copied into the library |

MAM is built on the Aleppo Codex. The Aleppo Codex lacks Psalms 15:1–25:1, so for Psalms 16–17 MAM rests on the
other early Tiberian manuscripts, which its notes cite by siglum (ש1, ק13, גסטר1, ל = Leningrad).

## Verdicts

| ref | MAM | UXLC | verdict | why |
|---|---|---|---|---|
| 17:12 | לטרף | לטרוף | keep MAM | MAM's note: every cited manuscript except Leningrad is defective; Breuer is defective |
| 33:7 | באוצרות | באצרות | keep MAM | MAM (Aleppo, no variant noted) and Breuer are plene |
| 90:8 | שַׁתָּ | שַׁתָּה | keep MAM | ketiv שת, qere שַׁתָּה (Aleppo, Leningrad, Breuer); MAM shows the written letters with the qere vowels, as Koren. Same pronunciation |
| 104:9 | ישבון | ישובון | keep MAM | MAM and Breuer are defective |
| 119:15 | בפקודיך | בפקדיך | keep MAM | MAM and Breuer are plene |
| 119:87 | פקדיך | פקודיך | keep MAM | MAM and Breuer are defective |
| 17:14 | יִשְׂבְּעוּ | יִשְׂבּעוּ | keep MAM | MAM's note marks the Leningrad form (no sheva) as a scribal slip; Breuer has the sheva |
| 72:15 | יְבָרְכֶנְהוּ | יְבָרֲכֶנְהוּ | keep MAM | see below |
| 104:1 | בָּרְכִי | בָּרֲכִי | keep MAM | see below |
| 104:35 | בָּרְכִי | בָּרֲכִי | keep MAM | see below |
| 119:69 | אֶצֹּר | אֱצֹּר | keep MAM | MAM and Breuer have segol |
| 119:175 | יַעְזְרֻנִי | יַעֲזְרֻנִי | keep MAM | MAM and Breuer have a silent sheva |

**72:15, 104:1, 104:35.** These are not different readings. After a ga'ya, the Aleppo and Leningrad scribes write
hataf-patah to mark a vocal sheva. MAM's own notes say so here (`א=בָּרֲכִי (חטף)`), and MAM and Breuer print the
plain sheva a reader expects. The word is pronounced the same either way.

## Re-running

The evidence files are re-fetchable and gitignored (`sources/**/raw/`). The verdicts are tied to the current
collation: if UXLC or MAM changes and a new difference appears, `tests/collation.test.js` and
`tests/review.test.js` fail until it is decided here.
