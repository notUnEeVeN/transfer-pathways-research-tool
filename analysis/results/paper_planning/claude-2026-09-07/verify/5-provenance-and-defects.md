# verify-5-provenance-and-defects — claim F6 (MA Fig 1, MassTransfer A2B split)

Reviewer stance: adversarial, PROVENANCE grounds only. Repository READ-ONLY (nothing under
`internal_tool/` touched). Scratch: this directory — `repro.py` / `repro_out.txt` (independent
reproduction from BOTH workbook vintages, bypassing `raw/heatmap.json`), `structure.py` /
`structure_out.txt` (slot columns, non-MT CC lists, MT-row templating), `robustness_out.txt`
(A2B split with slot columns removed; served-DB values), `workbook_notes_out.txt` (every cell
comment in the final heatmap workbook + the `OG Work` source-note columns), `final_pdf.txt`
(pdftotext of the final PDF), `cells_both_vintages.json`.

## Claim under review

"MassTransfer A2B mapping is the Massachusetts mechanism: the 38 A2B-flagged pairs average
56.9% vs 32.7% for the 127 unmapped pairs (lower-only 83.4 vs 49.7), within Bridgewater 53.6 vs
21.8, and 101 of 270 requirement columns (20 lower-division) articulate at no CC; UMass Lowell
(61.7%, no A2B) shows a dense equivalency database can substitute."

Where the evidence lives: the task names `scratchpad/dossier-coverage-heatmap (...)/report.md`,
which does not exist (peer verifiers 0–2 found the same). The numbers come from
`scratchpad/dossier-fig1/ma.py` → `ma_out.txt` (reads committed `server/data/ma/raw/heatmap.json`),
and the narrative from `scratchpad/dive-ma-failure-map/report.md` §0, §2, §3.

## Verdict in one line

Every number is VERIFIED at the final-repo vintage and is immune to the uncommitted working tree
and to every catalogued live defect — but the sentence is materially misleading on provenance:
the "MT" flag is the authors' DATA-SOURCE marker as much as a policy attribute (A2B pairs were
transcribed from a pathway template; unmapped pairs from equivalency look-ups that record CC
courses as "N CS Electives"), so 56.9 vs 32.7 is a contrast between two recording methods as
much as between two policy states; and the UMass Lowell sentence is unsupported by any artefact
(no source is recorded for Lowell; its 61.7% contains 10 lower-division "any course"/elective
slot columns covered 15/15 by construction — named columns only, Lowell is 47.7%).

## 1. Vintage and corpus of every number (VERIFIED unless marked)

Corpus throughout: MA, major ma-cs, BS-in-CS named requirements, GE excluded, course counts,
165 CC×university pairs, 270 requirement columns. No verified-cohort concept exists for MA
(templates are `paper_source`; the Fig 1 knob has no `verifiedOnly`).

| number in claim | artefact vintage | reproduced? |
|---|---|---|
| 38 A2B / 127 unmapped | final repo `final/Four Year Heatmap.xlsx`, column "MT" (values: exactly `MT` ×38, blank ×127; no variants) | VERIFIED; identical in the older `recovered/Mass Heatmap.xlsx`; matches the final PDF prose "only 38 out of the 165 pairs studied (23%)" |
| 56.9 vs 32.7 | final repo | VERIFIED 56.9054 / 32.6903. Older vintage: **56.65** / 32.69 (one MT cell differs: Dartmouth×Cape Cod 14/31 final vs 11/31 older) |
| lower-only 83.4 vs 49.7 | final repo; "lower" = converter-solved boundary that reproduces the workbook's own Lower column for all 165 cells | VERIFIED 83.40 / 49.69 (older: 82.91 / 49.69) |
| Bridgewater 53.6 vs 21.8 (n=10 vs 5) | final repo | VERIFIED; same in older vintage |
| A2B pair counts Bridgewater 10, Fitchburg 11, Amherst 11, Dartmouth 6 | final repo | VERIFIED; consistent with the PDF ("four of the 11 four-years") and with the PDF's "four Community Colleges for which no pathway was included" = Bunker Hill, Holyoke, Mount Wachusett, Roxbury (0 MT flags each) |
| Lowell 61.7%, no A2B | final repo | VERIFIED 61.7, 0 MT flags |
| 101 of 270 dead columns, 20 lower-division | final repo | VERIFIED 101 / 20 (55 columns fully covered); identical in older vintage |
| `raw/heatmap.json` ≡ final workbook (mt, matrix, boundary, headers) | committed d679f0f 2026-09-07 08:06 | VERIFIED equal on all 11 universities |

The claim never names its vintage. It should say "final repo workbook"; the served site would
not give the same A2B mean (see §3).

"Matches orchestrator scouting 56.9/32.7" is NOT independent corroboration: the brief's scouting
and the dossier's `ma.py` are the same computation on the same committed file.

## 2. Working tree, Codex audit, defect catalogue — none touch this claim

- `git status` shows NO change under `server/data/ma/{raw,final,recovered}`; `git diff HEAD`
  contains no A2B/MassTransfer/`mt` change (the only `mt` hit is a Tailwind `mt-1` class). The
  dossier's `ma.py` reads the committed raw JSON, not the DB and not the engine, so the
  uncommitted `pathways.js`/`degreeSlots.js` edits that bit peer claims F1–F3 are irrelevant here.
- `docs/analysis-audit-2026-09-07.md` (untracked, the other Codex audit): "Massachusetts's
  literal raw archive was preserved"; Fig 1 reproduces 165/165 final-workbook ratios at
  38.2671312%. It does not mention the MT column. Numerically the claim survives that audit.
- `docs/figure-defect-catalogue.md` does not exist on `main` (peers verified: refactor branch
  only). None of its items can reach this claim: the MT column is NOT imported into the site at
  all (`server/scripts/ma/figureLedgers.js:189`, `figure-ledgers.json.mass_transfer.verdict =
  "not imported"`; served `coverage_ma-cs.json` rows carry no MT/A2B field). Compare-tab knob
  leakage (#1), tier-resolver bypass (#2), Or-collapse (#3), VA Fig 6 (#4) are all engine-path
  defects on other corpora.
- No VA `method_status: estimated` rows are involved (MA only).

## 3. The one live divergence: the served database is one MT cell behind

The live DB still holds the OLDER heatmap for Dartmouth×Cape Cod (served 11/31 = 35.5, PDF
prints 45, final workbook 14/31) — VERIFIED from the dossier's `coverage_ma-cs.json`; the Codex
audit doc confirms ("Cape Cod → Dartmouth is 14/31, not the obsolete 11/31"). That cell is
MT-flagged, so anyone recomputing the split from the site's data (were MT imported) gets
**56.65 / 32.69** and Dartmouth-within 43.0 vs 31.9, not 44.6 vs 31.9. Immaterial in size,
but the claim's exact figures are final-repo-only and cannot be shown in the tool today.

## 4. Provenance of the MEANING of the MT flag (the substantive problem)

What the artefacts say the flag is (VERIFIED quotes):
- Final PDF: "To determine course equivalency, we looked at three data sources. The first was
  MassTransfer's A2B Transfer Database ... only 38 out of the 165 pairs studied (23%) were in
  the A2B Database ... To analyze the remaining pairs, we found articulation agreements located
  on the websites of the Four Years and located in the MassTransfer Course Equivalency
  Database." And: "the Four Years with the highest equivalency rates are the pathways found in
  the A2B Database (our initial data source)."
- Workbook `Bridgewater!D1` comment on the MT header: "MassTransfer". `OG Work` (the per-pair
  free-text source notes): MT rows are near-verbatim copies of one template ("Calc I, Calc II,
  Phys I, Phys II, CS I, CS II, Structures, Organization, CS Elective, CS Elective, Linear,
  Discrete"); non-MT rows are equivalency look-ups that read "Computers/Appl: An Intro, 40 CS
  Electives" (Bunker Hill→Bridgewater), "Exploring the Internet, 17 CS Electives" (Mount
  Wachusett→Lowell). Other comments: "I got banned from transferology :/", UMass Boston "All of
  this is unofficial through transferology", Amherst "everything on MassTransfer says
  'Equivalent not offered at ___' but is still equivalent??".
- MT matrix rows are templates, not pair-level findings: Bridgewater's 10 MT rows collapse to 3
  distinct patterns (8 identical), Amherst's 11 to 2 (9 identical); every non-MT row is distinct
  (VERIFIED, `structure_out.txt`).

Consequence: an MT=True cell means "a published A2B pathway document listed this named course",
an MT=False cell means "an equivalency database/website mapped CC courses, mostly to unnamed
elective credit". The 24-point gap therefore bundles (a) the policy effect the claim asserts
and (b) the recording granularity of the source. The paper's own conclusion is (b)-flavoured:
"there are more courses that could articulate but are just not included in the state's A2B
Database" — and the dive's own §3 finds Mount Wachusett offers every concept yet articulates
Data Structures 0/9. The claim's caveat ("applied consistently ... unverified") does not name
this confound. This is INFERRED from the artefacts, but it is the artefacts' own account.

What does survive: the contrast is robust to the column definition — with slot/elective columns
removed the split WIDENS (A2B 62.1 vs 30.4 named-only; 80.5 vs 44.8 lower-named; 81.0 vs 34.1
lower-named computing only), and the dive's two-way FE estimate (+16.8 pp net of CC and
university) is a legitimate within-institution control. Within-university comparisons rest on
tiny non-MT groups (5/4/4/9) that are mostly the same four never-mapped CCs.

## 5. The UMass Lowell sentence is not supported by any artefact

- Composition (VERIFIED): Lowell has 31 columns, 12 are slot columns; 10 of its 22 LOWER-division
  columns are "General Elective (any course)" ×4, "Natural Science Elective" ×4, "Technical
  Elective" ×2 — each covered 15/15 by construction. Named columns only, Lowell = **47.7%**
  (4th, below Fitchburg 67.5 / Bridgewater 49.8 / Amherst 48.2, above Dartmouth 43.2); lower-
  division named computing columns only = 57.8 vs 81.0 for A2B pairs. Its 61.7 is the slot-
  heaviest university mean in the state (slot-only coverage 83.9%). Peer verify-0 measurement
  report independently put Lowell's slot contribution at +32 pp.
- Source (VERIFIED absence): the only Lowell source annotation in the workbook is the UML
  catalog degree-pathway URL (`UMass Lowell!A1`) and a "???" (`F3`). `OG Work` for Lowell lists
  "Computing I–IV, Assembly Language Programming, Exploring the Internet, N CS Electives" per CC
  — the same "N CS Electives" pattern as every other non-A2B university. Nothing records that
  Lowell's cells came from the MassTransfer equivalency database rather than the UML site or
  Transferology. "Dense equivalency database" is the dossier's inference, not a fact in any
  vintage. "Can substitute" is then doubly unsupported: on the slot-free measure Lowell does not
  reach the A2B-pair level.

## 6. The dead-column census

101/270 and 20 lower-division are exact at both vintages. But 81 of the 101 are upper-division
columns (structurally non-articulable; 34 upper columns DO articulate somewhere, mostly "Upper
Level Elective" placeholders), and the 270 includes repeated placeholders (Fitchburg 5× "Upper
Level Elective (3000)") and duplicates (MCLA "Programming in Java II" twice). The parenthetical
is correct; the headline "101 of 270 requirement columns articulate at no CC" reads as a
finding about articulation when four-fifths of it is degree design.

## 7. Corrected claim that survives

"In the final-repo heatmap workbook (165 pairs, GE excluded, course counts), the 38 pairs the
authors transcribed from a MassTransfer A2B pathway average 56.9% vs 32.7% for the 127 pairs they
filled from equivalency databases and university websites (lower-division 83.4 vs 49.7; within
Bridgewater 53.6 vs 21.8 on 10 vs 5 pairs; the gap widens to 62.1 vs 30.4 on named columns
only). Because the MT flag also marks the data source — A2B rows are template copies, non-A2B
rows are look-ups that record CC courses as unnamed electives — the gap measures the presence
of a published named-course map at least as much as any difference in articulation. 20 of 130
lower-division columns articulate at no CC (81 of the 140 upper-division columns also do not).
UMass Lowell reaches 61.7% with no A2B pathway, but 10 of its 22 lower-division columns are
any-course/elective slots covered everywhere by construction; on named columns it is 47.7%,
and the workbook records no source for its equivalencies."
