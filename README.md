# תהילים ואזכרה — Tehillim & Azkara

A static, phone-first site that builds a memorial reading order (Tehillim by the letters of the
name, נשמה, and later Mishnayot, Kaddish and El Male Rachamim) from a **local, version-locked,
vowelled text library**. No backend, no sign-up, and no external text APIs at reading time.

The product decisions, research and source register are in
[`docs/PROJECT_MASTER.md`](docs/PROJECT_MASTER.md). It is the single source for *why*.

## Run

```sh
npm run serve            # http://127.0.0.1:8080/ (same layout as the published site)
npm test                 # node --test (no dependencies)
node scripts/a11y-audit.mjs  # accessibility gate (axe + keyboard + reflow); needs: npm i --no-save playwright axe-core
npm run import:mam       # re-download the locked MAM Psalms source and rebuild data/psalms
npm run build:reading    # rebuild data/reading from the editions named in lib/editions.js
npm run build:site       # assemble _site/ as GitHub Pages publishes it
```

## Layout

| path | what |
|---|---|
| `site/` | the static page (HTML/CSS/JS modules, self-hosted fonts, vendored QR encoder); `scripts/assemble-site.mjs` publishes it at the root with `lib/` and `data/` beside it. Every push to `main` deploys to https://lenishmat.co.il/ (`.github/workflows/pages.yml`; the custom domain is set in the repo's Pages settings, and the old github.io address 301-redirects to it with path and query intact) |
| `lib/` | pure modules shared by site, scripts and tests (`hebrew.js` marks, `psalm119.js` letters) |
| `data/` | generated, committed text data the site reads |
| `scripts/` | importers (one per source) and the dev server |
| `site/accessibility.html` | הצהרת נגישות (IS 5568 / WCAG 2.1 AA), linked from every page; `scripts/a11y-audit.mjs` gates the deploy on it |
| `site/about.html` | "אודות ומקורות": every text source with its license (the attribution the licenses require), fonts, build label |
| `firestore.rules`, `firebase.json`, `site/feedback-config.js` | in-app feedback: reports go to a create-only Firestore collection (`lib/feedback.js` defines the fields). Feedback buttons stay hidden while `feedback-config.js` exports `null`; deploy the rules with `firebase deploy --only firestore:rules` |
| `sources/<source>/` | provenance notes per source; `raw/` downloads are gitignored and re-fetchable |
| `tests/` | `node:test` suites |

## Text status

Every text carries a `reviewStatus`:
`DISCOVERED → RIGHTS_CHECKED → IMPORTED → STRUCTURE_VALIDATED → INDEPENDENTLY_COMPARED → PROOFREAD → COMMUNITY_REVIEWED → PUBLISHED`.
Nothing is marked `PROOFREAD` without an actual human proofread.

| text | source | status |
|---|---|---|
| Psalms 16, 17, 33, 72, 90, 91, 104, 119, 130 (320 verses) | MAM, git blob `a5e2296`, CC BY-SA 4.0 | `INDEPENDENTLY_COMPARED` against UXLC 2.5: 12 differences, all kept as MAM ([REVIEW.md](sources/wlc/REVIEW.md)) |
| Mishnah Mikvaot 7, Kelim 24 | reading base: Sefaria Torat Emet 357 (PD); compared with Be'eri, Be'eri-Kaufmann, Romm Vilna | `INDEPENDENTLY_COMPARED`, one display correction ([REVIEW.md](sources/mishnah/REVIEW.md)) |
| Ashkenaz Kaddish Yatom, Kaddish DeRabbanan, El Male Rachamim | reading base: Metsudah (CC-BY); compared with Daat (PD), Wikisource | `INDEPENDENTLY_COMPARED`, three corrections ([REVIEW.md](sources/prayers/REVIEW.md)) |
| Sefard Kaddish | Metsudah Siddur Sefard (CC-BY); compared with Wikisource | imported and compared ([SOURCE.md](sources/customs/SOURCE.md)) |
| Edot HaMizrach / Moroccan Kaddish | Shaliehsaboo (CC0); compared with Torat Emet 357, Wikisource | imported and compared |
| Yemenite (Baladi) Kaddish and Hashkava | Wikisource Baladi siddur (CC BY-SA); compared with Hamichlol (comparison only) | imported and compared |
| Sephardic Hashkava (short, long; man, woman), כל ישראל | Torat Emet 357 (PD); compared with Wikisource, Shaliehsaboo | imported and compared; missing points completed from witnesses, logged |

Every template in `lib/templates/` is a candidate custom, not yet confirmed with a community.

Edition choices and the other open decisions are recorded in the master doc, "החלטות ביצוע — 15.10.2026".

## Licensing

Attribution for every text is on the site's `about.html`; printed copies point there.

Biblical text: *Miqra according to the Masorah*, Hebrew Wikisource, CC BY-SA 4.0
(see `sources/mam/LICENSE.md`). The importer is our own code; MAM-basics' GPL code is not used.
