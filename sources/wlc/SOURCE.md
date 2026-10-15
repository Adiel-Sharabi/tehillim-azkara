# WLC comparison text (UXLC, tanach.us)

**Caveat:** this is a *comparison base* for collating MAM, not the primary edition, and nothing in it is proofread.
Per the site's own notice it is the Unicode/XML Leningrad Codex (UXLC), derived from WLC 4.20, and must not be presented as "the WLC".

| | |
|---|---|
| Source file | https://tanach.us/Books/Psalms.xml (whole book of Psalms, TEI-headed XML) |
| Retrieved | 2026-10-15 |
| Version (from the XML header) | `UXLC 2.5`, build 27.6, edition date 1 Apr 2026 (header `buildDateTime`: 31 Mar 2026 12:00); base text `WLC 4.20` (Groves Center, 25 Jan 2016) |
| Raw file | `sources/wlc/raw/Psalms.xml` (gitignored), 780,618 bytes |
| SHA-256 | `7b09e7fc308858a25da6f95f9c9a24078a1b4e160dbf89a2cac786ea3142e05c` |
| Output | `sources/wlc/psalms_wlc.json` (Psalms 16, 17, 33, 72, 91, 104, 119, 130: 303 verses) |

## License

Page: https://tanach.us/License.html (retrieved 2026-10-15). Exact wording:

> All biblical Hebrew text, in any format, may be viewed or copied without restriction.
>
> Citation of the Tanach.us site as the source of the text is appreciated:
> Unicode/XML Leningrad Codex: UXLC 2.5 (27.6), Tanach.us Inc., West Redding, CT, USA, Apr 2026.
>
> The text presented at this site is not the Westminster Leningrad Codex (WLC); please do not represent it as such.
>
> Documents with restrictions: Files in the Fonts directory are the property of other organizations. [...]
> All other files and the look-and-feel of the site are copyrighted by Tanach.us Inc. and require written permission for any purpose.

Notes: the page does not use the words "public domain"; the grant is "without restriction" for the Hebrew text. The raw
XML carries `<!-- Copyright C.V.Kimball 2013 -->` and `<availability status="free">Freely available</availability>`.
Only the Hebrew text is extracted into `psalms_wlc.json`; the raw XML (header, corrections log, markup) is not committed.
If this text is shown on the site, use the citation line above and call it UXLC / "Leningrad Codex (UXLC)", not "WLC".

## Regenerate

```
mkdir -p sources/wlc/raw
curl -L -o sources/wlc/raw/Psalms.xml http://tanach.us/Books/Psalms.xml
node scripts/import-wlc.mjs
```

* The script refuses a raw file whose SHA-256 differs from `LOCK` in `scripts/import-wlc.mjs`. tanach.us republishes
  on 1 April and 19 October (its change log has entries for both dates), so **a re-download after 2026-10-19 is expected to
  fail the lock**. Review the new file, then `--allow-source-update`, and update `LOCK`, this file and `--retrieved-at`.
* It also throws on any element it does not handle in the extracted chapters, and on any verse count that differs from
  `EXPECTED_VERSES` or from the source's own chapter/book `<vs>`/`<cs>` totals (150 chapters, 2527 verses).
* TLS: on the machine used on 2026-10-15 `https://tanach.us` is re-signed by a local content filter (Netspark), so curl
  rejects the chain. The file was fetched over plain HTTP and again over HTTPS with `-k`; both were byte-identical
  (same SHA-256). The SHA-256 lock is what protects later runs.

## Output format

`{ source, chapters, ketiv }`. `chapters["119"]["1"]` is the verse text exactly as in the source: words joined by a single
space except after maqaf (U+05BE), the QERE as the reading, `<x>` transcription notes removed, **no Unicode normalisation**
(the source is not NFC; 294 of the 303 verses would change under NFC, so normalise both sides before collating).
`ketiv[chapter][verse]` is a list of `{ wordIndex, ketiv: [...], qere: [...] }`; `wordIndex` counts source units
(`<w>`, or each `<q>`), not whitespace-split tokens, because a `<w>` can contain a space plus paseq.
Invisible characters are present in the source and kept: U+034F (CGJ) and U+200D (ZWJ).
