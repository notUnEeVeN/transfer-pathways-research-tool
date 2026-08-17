# Massachusetts source data — provenance

Vendored 2026-08-14 from the paper repo checked out at
`../ma_paper/transferpaper` ("Lost in Transfer: Examining CS Transfer
Pathways from Community College in Massachusetts", SIGCSE Virtual draft).

- `Mass Heatmap.xlsx`, `CurrComp Master.xlsx` — copied from the working tree
  (`Code + Sheets/`).
- `All CC AS.xlsx`, `Community College Heatmap.xlsx`,
  `All Pathways/*.xlsx` (11 university workbooks) — extracted from git
  history commit `59c1b77f970b273ea5ab2f4fced7111a3ecbbc98` ("leaning git
  rn"); these files are absent from the upstream working tree and exist only
  in history. Re-extract with
  `git show 59c1b77…:Sheets/<name>` if this copy is ever questioned.

All numeric comparisons pin to the **final submitted PDF**
(`2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf`), not the repo's stale LaTeX
draft: published Figure 1 mean 38.2% (all-levels, GE excluded), Fig 3
average transfer credit rate 68%, Fig 4 average +13 credit hours, Fig 5
average $7,129, Fig 6 average +15 complexity.

Known internal inconsistency carried by the source (kept, not corrected):
the Bridgewater resident pathway tab sums to 123 credit hours while the
published `Credit Hours` sheet's Resident row says 120. The importer reports
such drifts as warnings; they feed the reproduction report's annotated
deltas.

`raw/` holds the deterministic JSON conversion produced by
`server/scripts/ma/convert_recovered.py`; regenerate any time with
`pmt-env/bin/python server/scripts/ma/convert_recovered.py`.

## Final-PDF figure transcription (2026-08-14)

The final SIGCSE PDF (2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf) prints
per-cell matrices that were generated from a NEWER revision of the tally
than the repo workbook. Figure 3 is transcribed in `pdf-figures.json`
(embedded figure image extracted at native resolution, read at 3x scale);
the importer folds it in as baseline measure `pct_as_pdf` behind two gates:
every column mean must reproduce the figure's own printed Average row, and
the studied-pair universe must equal the repo tally's. Figures 4/5/7 are
printed in the same PDF and can be transcribed the same way if needed.
