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

## Final paper repository (added 2026-09-02) — `final/`

`final/Pathways Master.xlsx` and `final/Four Year Heatmap.xlsx` come from the
paper's own repository (`CIC-CC-Paper`), together with the four notebooks that
generate every figure, kept in `final/notebooks/` for reference.

    Four Year Heatmap.xlsx  d72d82489d4f0f6809602a5afaca65b3e47896d4ddb8eb576dd6a0f009cae3ff
    Pathways Master.xlsx    06cb9a546ccc0bb2c9095573e517b7ae288227f819142c64c157240806daa85f

**These are the workbooks the published PDF was generated from.** Tested cell by
cell against our own transcription of the final PDF, which is the neutral
referee — whichever workbook reproduces the printed numbers is the one the paper
used:

| figure | `recovered/` (older) | `final/` |
|---|---|---|
| Fig 1 course articulation | 164/165 | **165/165** |
| Fig 3 % of AS applied     |  50/61  | **61/61**  |
| Fig 4 extra credit hours  |  39/49  | **49/49**  |
| Fig 5 extra cost          |  39/49  | **49/49**  |
| Fig 6 complexity delta    |  48/49  | **49/49**  |

The note above about the PDF being "generated from a NEWER revision of the tally
than the repo workbook" is now resolved: this IS that revision. The
`printed_cell_overrides` entry for Cape Cod x UMass Dartmouth (PDF 45, archive
35.5) is produced natively by the final heatmap and no longer needs overriding.

What changed between the two vintages: resident curricula were normalised to
exactly 120 hours (Framingham 122, Salem/Amherst/Lowell 121), ten transfer
pathways with excess hours were revised to 120 with $0 added cost, and the
`Tallys` sheet was revised for Fitchburg (Comp/Math counts 90/75 -> 75/90) and
Framingham (75/30 -> 60/45).

`recovered/` is NOT superseded and is not edited. It remains the only source for
`All CC AS.xlsx` and the eleven `All Pathways/*.xlsx` workbooks, which the final
repository does not carry and which exist only in upstream git history.
`convert_recovered.py` therefore reads the heatmap and the figure baselines from
`final/` and everything else from `recovered/`.

### Consequences of the update, recorded rather than smoothed over

- **No per-credit rate for UMass Amherst or UMass Dartmouth.** The rate is
  back-derived as cost / hours-above-120, and in the final workbook every
  studied pathway at those two campuses lands at exactly 120. The paper prints
  nine rates for the same reason. Nine are derived; two are absent by fact.
- **Cape Cod x UMass Dartmouth now disagrees the other way.** The final heatmap
  says 45.2% and our reconstruction from the (unchanged, older) pathway workbook
  says 35.5%. The paper updated its heatmap without updating that pathway
  workbook, or our git-history copy predates the fix.

### An error in the paper's own Figure 2 notebook, NOT reproduced

`course_distribution.ipynb` hard-codes its per-university percentages rather
than reading `Tallys`, and the list is misaligned. `Tallys` orders the campuses
Boston, Dartmouth, Lowell; the notebook's `UNI_LIST` says Boston, Lowell,
Dartmouth, and its `SCI` array is the Tallys column shifted by one from index 6:

    campus            notebook   Tallys
    UMass Boston        1.00      0.53
    UMass Lowell        0.53      0.97
    UMass Dartmouth     0.78      0.78
    Westfield           0.97      1.00

Its `COMP` array does not reconcile with either vintage of `Tallys` at all
(Bridgewater 0.30 against 43/60 = 0.72). Figure 2 is therefore not reproduced
from the notebook's constants; `methodsAudit.js` reports the deviations. This is
the one place the final repository is followed as evidence rather than as
method.
