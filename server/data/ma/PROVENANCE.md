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

All published-number comparisons pin to the **final submitted PDF**
(`2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf`), not the repository's older
LaTeX/workbook state. The archive remains a separately labeled replication
source; it is never silently substituted for a final-PDF cell.

Known internal inconsistencies carried by the archive are kept rather than
silently corrected. They include the Bridgewater resident pathway tab's 123
hours versus the typed `Credit Hours` resident row's 120, eight transfer-path
master/detail hour conflicts, the STCC 63-versus-61 Figure 3 denominator, and
the Bristol→UMass Dartmouth graph score 174 versus typed 170. The importer and
audit artifacts report these drifts; see `docs/ma-paper-audit.md` for the exact
version-aware classification.

`raw/` holds the deterministic JSON conversion produced by
`server/scripts/ma/convert_recovered.py`; regenerate any time with
`pmt-env/bin/python server/scripts/ma/convert_recovered.py`.

## Final-PDF figure transcription (updated 2026-08-18)

The final SIGCSE PDF (2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf) prints
per-cell matrices that were generated from a NEWER revision of the tally
than the repo workbook. `pdf-figures.json` contains the Figure 1 final/archive
gate and literal final-PDF matrices for Figures 3, 4, 5, and 6, plus their
printed averages and arithmetic gates.
It pins that source file by SHA-256
`5024b34ae6dd40f0fe735f75844d8c341de27b9df668756905a78f03f35c488a`
and byte size `1008665`, the same receipt used by the Figure 2 transcription.
Figure 1 matches the archived rounded matrix in 164/165 cells; its complete
165-cell final display is frozen, with Cape Cod→UMass Dartmouth 45% and the
printed 37% Dartmouth average kept separate from the archived 35%/36%
reconstruction. Missing final keys fail closed rather than falling back to the
archive. The importer stores
Figures 3–5 as distinct `pct_as_pdf`, `extra_hours_pdf`,
and `extra_cost_pdf` baselines. Figure 6 is served directly from its immutable
matrix rather than reconstructed from the older score tab. Every matrix must
reproduce its printed averages and exact cell count; Figures 4 and 5 must also
have an identical 49-pair key set.

Figure 2 is an unlabeled point plot rather than a cell matrix. Its final-PDF
dot transcription and source SHA live in
`frontend/src/analyses/data/ma-figure2-final-pdf.json`; category populations
are explicitly 11/11/11/5 and campus identities are not inferred. The
Computing 22 and Science 93 points are obscured by their mean diamonds and
explicitly marked as inferences; Math 63 is partly occluded. Figure 7's
61/61/49/61 cohort reconciliation is recorded in `pdf-figures.json` and in the
paper-audit documents.
