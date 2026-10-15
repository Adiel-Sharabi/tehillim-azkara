Fonts used by this site, served from this folder (no font service is contacted).

Reading fonts (Hebrew with vowel points and cantillation marks), from the Culmus project,
release 0.140 (https://culmus.sourceforge.io/), GNU GPL v2 with the font exception:
  FrankRuehlCLM-Medium.woff2, FrankRuehlCLM-Bold.woff2   (Frank Ruehl CLM, default)
  KeterYG-Medium.woff2, KeterYG-Bold.woff2               (Keter YG)
  NachlieliCLM-Light.woff2, NachlieliCLM-Bold.woff2      (Nachlieli CLM, sans-serif)
  Each was checked to draw cantillation as well as vowels (Hadasim and Simple CLM do not).
  Licence: LICENSE-culmus.txt, GNU-GPL-2.txt

Interface font: Assistant (variable weight), from the Google Fonts repository (ofl/assistant),
SIL Open Font License 1.1. Licence: OFL-assistant.txt

Changes made: each font was subset to Hebrew (U+0591-05F4, FB1D-FB4F), basic Latin, common
punctuation and U+25CC, keeping every OpenType layout feature (the mark positioning that places
vowel points and cantillation), and converted to WOFF2 with fontTools:

  pyftsubset <font> --unicodes=U+0020-007E,U+00A0,U+00B7,U+00D7,U+0591-05F4,U+FB1D-FB4F,
    U+200C-200F,U+2010-2027,U+2030-205E,U+2212,U+25CC --layout-features=* --flavor=woff2
    --name-IDs=* --name-languages=* --notdef-outline

The unmodified originals are available from the sources above.

----

QR codes are drawn by qrcode-generator 1.4.4 (Kazuhiko Arase, MIT licence), vendored as
vendor/qrcode.js. See vendor/LICENSE-qrcode.txt.
