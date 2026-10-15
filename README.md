# תהילים ואזכרה — Tehillim & Azkara

A static, phone-first site that builds a memorial reading order (Tehillim by the letters of the
name, נשמה, and later Mishnayot, Kaddish and El Male Rachamim) from a **local, version-locked,
vowelled text library**. No backend, no sign-up, and no external text APIs at reading time.

The product decisions, research and source register are in
[`docs/PROJECT_MASTER.md`](docs/PROJECT_MASTER.md). It is the single source for *why*.

## Run

```sh
npm run serve            # http://127.0.0.1:8080/site/
npm test                 # node --test (no dependencies)
npm run import:mam       # re-download the locked MAM Psalms source and rebuild data/psalms
```

## Layout

| path | what |
|---|---|
| `site/` | the static page (HTML/CSS/JS modules) |
| `lib/` | pure modules shared by site, scripts and tests (`hebrew.js` marks, `psalm119.js` letters) |
| `data/` | generated, committed text data the site reads |
| `scripts/` | importers (one per source) and the dev server |
| `sources/<source>/` | provenance notes per source; `raw/` downloads are gitignored and re-fetchable |
| `tests/` | `node:test` suites |

## Text status

Every text carries a `reviewStatus`:
`DISCOVERED → RIGHTS_CHECKED → IMPORTED → STRUCTURE_VALIDATED → INDEPENDENTLY_COMPARED → PROOFREAD → COMMUNITY_REVIEWED → PUBLISHED`.
Nothing is marked `PROOFREAD` without an actual human proofread.

| text | source | status |
|---|---|---|
| Psalms 16, 17, 33, 72, 91, 104, 119, 130 (303 verses) | MAM, git blob `a5e2296`, CC BY-SA 4.0 | `STRUCTURE_VALIDATED`; machine-collated against UXLC 2.5: 11 differences awaiting a human decision ([COLLATION.md](sources/wlc/COLLATION.md)) |
| Mishnah Mikvaot 7, Kelim 24 | reading base: Sefaria Torat Emet 357 (PD); compared with Be'eri, Be'eri-Kaufmann, Romm Vilna | imported, not proofread |
| Kaddish Yatom, Kaddish DeRabbanan, El Male Rachamim | reading base: Metsudah (CC-BY); compared with Daat (PD), Wikisource | imported, not proofread |

Edition choices and the other open decisions are recorded in the master doc, "החלטות ביצוע — 15.10.2026".

## Licensing

Biblical text: *Miqra according to the Masorah*, Hebrew Wikisource, CC BY-SA 4.0
(see `sources/mam/LICENSE.md`). The importer is our own code; MAM-basics' GPL code is not used.
