# Mishnah sources: Mikvaot 7 and Kelim 24

Vowelled Mishnah text for the azkara readings, imported once into `mishnah.json`. The site never calls
Wikisource or Sefaria at runtime. Every edition in the JSON has `reviewStatus: "IMPORTED"`. Nothing here has
been proofread against a manuscript or a printed edition; **do not mark any of it PROOFREAD without a human
review**.

Retrieved: 2026-10-15 (UTC `2026-10-15T05:22:41Z`, recorded as `source.retrievedAt` and in `raw/manifest.json`).

## What is in the JSON

`mishnah.json` -> `editions.<editionId>` = `{ source, reviewStatus, texts }`, where
`texts["Mikvaot.7"]["1".."7"]` and `texts["Kelim.24"]["1".."17"]` are plain strings (one mishnah each, words
separated by single spaces). Vowel marks are exactly as upstream: not added, removed, re-ordered or normalised.

| editionId | What | License (exact upstream string) | Pin |
|---|---|---|---|
| `wikisource-beeri` | Hebrew Wikisource vowelled Mishnah (Kaufmann MS, base text Rabbi Dan Be'eri) | CC BY-SA 4.0 (site-wide license from `meta=siteinfo`) | Mikvaot 7: revid 2877402 (2024-09-02T10:39:24Z); Kelim 24: revid 2835142 (2024-01-23T02:38:38Z) |
| `sefaria-torat-emet-357` | Sefaria version "Torat Emet 357" (vowelled print text) | `Public Domain` | no revid exists; sha256 of the raw response per page in `source.pages.*.rawSha256` |
| `sefaria-beeri-kaufmann` | Sefaria version "Mishnah based on the Kaufmann manuscript, edited by Dan Be'eri" (archive.org file) | `PD` (Sefaria's spelling; read as Public Domain) | same |
| `sefaria-romm-vilna-1913` | Sefaria version "Mishnah, ed. Romm, Vilna 1913" (**unvowelled**) | `Public Domain` | same |

Because the Wikisource edition spans two pages, `revid`, `timestamp`, `title`, `url` live per chapter under
`source.pages["Mikvaot.7"|"Kelim.24"]` (not directly on `source`). The same `pages` layout is used for
Sefaria editions (which carry `rawSha256` and `apiUrl` instead of a revid).

Sefaria also lists English, German and Portuguese translations (Kulp CC-BY, Goldschmidt, Sefaria Community
Translation CC0, others). They are not Hebrew and were not imported. All three Hebrew versions have an eligible
license, so none were skipped.

## Wikisource (primary)

- Pages: `משנה מקוואות ז ניקוד` and `משנה כלים כד ניקוד`. Header templates declare 7 and 17 mishnayot; the
  importer asserts this, that the section labels run א..ז / א..יז in order, and that nothing sits outside the
  sections.
- Method: **wikitext** via `action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main`. Text lives
  between `<קטע התחלה=X/>` and `<קטע סוף=X/>` section tags; the `===...===` headings and
  `{{המשנה|...}}` templates are stripped and validated. Leading `:`/`::` indentation (Be'eri's line layout in
  Kelim) is dropped and lines are joined with a space. Characters are restricted to Hebrew letters, Hebrew marks
  U+0591-U+05C7, space and `.,:;!?'"()-`; anything else fails the import.
- Cross-check: each extracted mishnah must appear verbatim in the **rendered** reader page
  (`action=parse&page=משנה מקוואות ז ד` etc., 24 pages). The ניקוד page itself renders empty for Mikvaot
  (Parsoid hides the section body), so the per-mishnah pages are the only rendered view. A one-shva mutation
  makes the check fail, so it is not vacuous. Note the reader pages are not revision-pinned; if someone edits
  the ניקוד page after a download, the check fails loudly.
- Editorial markup: neither page contains `<>`/`{}`/footnotes. One parenthetical is kept verbatim and flagged in
  `importFlags`: Kelim 24:14 `(וְשֶׁל)` (probably a deletion marker; kept as upstream has it, a human should decide whether to show it).
- Attribution (CC BY-SA 4.0 needs credit and ShareAlike): credit "Hebrew Wikisource contributors", link the page
  histories (`source.pages.*.historyUrl`; registered contributors are listed in the JSON, anonymous edits are
  only counted). Be'eri's own note says he permits anyone to use and distribute his file "without any
  restriction, even without citing my name", but the Wikisource copy carries the wiki license, so treat the
  text as CC BY-SA 4.0 unless a stricter reading is wanted. Decision for the site owner, not legal advice.
- Page history: Mikvaot 7 was created in 2014 by an anonymous paste and has had two later content edits (2016;
  a 2023 fix in mishnah 6). Kelim 24 was created in 2014 and re-edited in January 2024 by one user ("Nahum").
  Neither page's wikitext nor any rendered mishnah page mentions Borer or the "proofread" title.

### Borer proofreading: NOT applicable to Mikvaot or Kelim

Methodology page `ויקיטקסט:משנה מנוקדת ומעוצבת`, revid 2980287 (2026-01-26T13:47:23Z). Text: after
"כל מסכת שכבר עברה הגהה, הכותרת שלה שונתה ... מוגהת ומוערת על ידי שמחה גרשון בורר" it says
"בינתיים בוצעה הגהה למסכתות הבאות:" and lists only:

- Zeraim: Berakhot, Peah, Demai, Shevi'it
- Moed (whole order): Shabbat, Eruvin, Pesachim, Yoma, Shekalim, Sukkah, Beitzah, Rosh Hashanah, Taanit,
  Megillah, Chagigah, Mo'ed Katan ("משקין")
- Nezikin: Avot

**Mikvaot and Kelim are not on the list**, and neither page carries the "proofread by Borer" title. The page also
states that the author stopped the Beeri-edition proofreading project in Tammuz 5782 (July 2022) and that the
page "is still under construction". The importer parses this list and records it under
`editions.wikisource-beeri.upstreamProofreading` (`mikvaotListed:false`, `kelimListed:false`) and fails if the
page layout changes.

## Neshama mishnayot check (Mikvaot 7:4-7)

Verified against the Wikisource text: 7:4 **נ**פל, 7:5 **ש**לשה, 7:6 **מ**קוה, 7:7 **ה**טביל = נ-ש-מ-ה. Torat
Emet and Romm open with the same four words. Sefaria's Be'eri text has the same initials but two different
words (7:5 `שְׁלֹשֶׁת` for שלשה, 7:7 `הַטּוֹבֵל` for הטביל). All four editions therefore give the initials נ-ש-מ-ה.

## Known issues in the imported text (observations, not a proofread)

- **Wikisource Mikvaot 7:4-7 is visibly weakly vowelled.** Missing shva and dagesh throughout (`אַרבָּעִים`,
  `מִקצַת`, `מִקוָה`, `הִטבִּיל`, `מַראֵה`, `דֶּרֶך`, `הוֹלֵך`), four bare `לא` with no holam (7:2, 7:4, 7:5 x2;
  more with a prefix, e.g. `וְלא` in 7:1), and `שְׁהִיא` in 7:7 where `שֶׁהִיא` is meant. Mark density
  (marks per letter) is 0.62 and 0.68 for 7:4 and 7:5 against 0.72-0.77 in the two vowelled Sefaria versions. Kelim 24 in
  Wikisource has no such gaps. If the Neshama mishnayot are shown vowelled, prefer a better source or a human
  fix; this text is not fit to display as is.
- Wikisource Kelim 24:15 has a typo `טָמֵא טְמֵת מֵת` (should be `טְמֵא מֵת`), one letter off from every other
  edition.
- Wikisource vs the printed text: Wikisource often keeps the printed Vilna wording where Be'eri's file reads
  differently (e.g. Mikvaot 7:1 `וְהַגְּלִיד ... הַטִּיט הַנָּרוֹק` vs Be'eri `וְהַגָּלִיד ... וְטִיט הַנָּדוֹק`).
- Sefaria Be'eri raw text: Be'eri's numbering follows the Kaufmann MS (several Be'eri sub-mishnayot per standard
  mishnah, in-text labels such as `<small>ב</small>` and `ו <ד>`). The importer strips those labels and the
  `<...>` notes (his record of the manuscript reading he replaced), HTML-entity decodes, and joins lines, so the
  sub-mishnah boundaries are lost. In Kelim 24 his Kaufmann numbering also reorders the chapter's tail (labels
  `יו`, `יד`, `יה` sit on the standard mishnayot 14, 15, 16); Sefaria aligns the contents to standard numbering.
- Sefaria and Wikisource Be'eri share the same ancestor (Be'eri's archive.org file), so they are not independent
  witnesses to each other. Torat Emet and Romm are independent print witnesses.
- Line structure (Be'eri's indented colon layout in Kelim) is flattened to one line per mishnah in the JSON; the
  raw wikitext keeps it if the site later wants it.

## Consonant-level diff (signal only)

`node scripts/diff-mishnah.mjs`: keep only letters U+05D0-U+05EA (drops marks U+0591-U+05C7, spaces,
punctuation), compare per mishnah against `wikisource-beeri`. Run 2026-10-15.

| Edition | Mikvaot 7 differing | Kelim 24 differing |
|---|---|---|
| `sefaria-torat-emet-357` | 5 of 7 (1, 2, 4, 5, 7) | 6 of 17 |
| `sefaria-romm-vilna-1913` | 7 of 7 | 10 of 17 |
| `sefaria-beeri-kaufmann` | 7 of 7 | 16 of 17 |

Edit distances are small (mostly 1-3 letters per mishnah against Torat Emet/Romm; Be'eri raw differs more in
Mikvaot 7:1-2 because of his Kaufmann spellings). Most differences are plene/defective spelling and wording
variants, not missing text. This says nothing about the vowel marks themselves.

## Regenerate

```
node scripts/import-mishnah.mjs --download   # fetch raw API responses + manifest, then build mishnah.json
node scripts/import-mishnah.mjs              # rebuild mishnah.json from the saved raw files (offline, deterministic)
node scripts/diff-mishnah.mjs                # print the consonant diff and mark-density tables
```

`sources/mishnah/raw/` is gitignored. It holds the verbatim API responses (wikitext, 24 rendered reader pages,
page histories, methodology page, site license, Sefaria `versions` and `v3 texts`) and `manifest.json` (URL,
sha256, size per file, one `retrievedAt`). The offline build refuses to run if any raw file no longer matches its
manifest hash. A new download moves the pins (revid / timestamp) forward; review the diff of `mishnah.json`
before committing it. Wikisource rate-limits `action=parse` (HTTP 429); the downloader backs off and retries.
