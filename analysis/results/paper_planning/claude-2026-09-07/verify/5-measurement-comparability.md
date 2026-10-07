# verify-5-measurement-comparability — claim F6 (MA Fig 1, "A2B mapping is the Massachusetts mechanism")

Reviewer stance: adversarial, MEASUREMENT grounds only. Repository read-only. Working scripts and raw
outputs beside this file: `recompute.py` / `recompute_out.txt` (split, instrument test, fixed effects,
dead columns, Lowell composition), `vintages.py` / `vintages_out.txt` (final-repo workbook vs raw JSON,
placeholder-free recompute, older-repo notebook), `pdf_split_out.txt` (final-PDF cells). The named
originating directory "dossier-coverage-heatmap (...)" does not exist; the evidence files the claim cites
are in `scratchpad/dossier-fig1/` (`ma.py`, `ma_out.txt`, `ma_cells.json`, no report.md) and the prose
that frames the claim is `scratchpad/dive-ma-failure-map/report.md` §2 and §4.

## The claim

"MassTransfer A2B mapping is the Massachusetts mechanism: the 38 A2B-flagged pairs average 56.9% vs
32.7% for the 127 unmapped pairs (lower-only 83.4 vs 49.7), within Bridgewater 53.6 vs 21.8, and 101 of
270 requirement columns (20 lower-division) articulate at no CC; UMass Lowell (61.7%, no A2B) shows a
dense equivalency database can substitute."

## 1. Do the numbers reproduce? Yes, on all three vintages (VERIFIED, our computation)

Corpus throughout: MA, major ma-cs, 11 public universities x 15 CCs = 165 pairs, GE excluded by the
authors' design, binary course COUNTS (COUNTIF/COUNTA over requirement columns, upper division kept in
the denominator), no verified-cohort or supply-basis dimension exists for MA.

| vintage | A2B pairs | mean | unmapped pairs | mean | lower-only A2B / unmapped |
|---|---|---|---|---|---|
| older repo (`server/data/ma/raw/heatmap.json`, conversion of `Mass Heatmap.xlsx`) | 38 | 56.9 | 127 | 32.7 | 83.4 / 49.7 |
| final repo (`server/data/ma/final/Four Year Heatmap.xlsx`, MT column read directly) | 38 | 56.9 | 127 | 32.7 | 83.4 / 49.7 |
| final PDF (`pdf-figures.json` printed whole-% cells x the workbook's MT flags) | 38 | 57.0 | 127 | 32.7 | n/a (PDF prints all-level only) |

The final-repo workbook and the raw JSON agree on all 165 cells and all 165 MT flags (0 differences),
so vintage is NOT a weakness of this claim. Within-university values reproduce exactly: Bridgewater
53.6 vs 21.8 (n 10 / 5), Fitchburg 74.3 vs 58.7 (11 / 4), Amherst 49.2 vs 30.7 (11 / 4), Dartmouth
44.6 vs 31.9 (6 / 9). Dead columns: 101 of 270, of which 20 lower-division. All VERIFIED.

The MT flag's meaning is documented (older repo README line 71: "The MT column is if the community
college has a A2B Mapped Standard MassTransfer Articulation Agreement"), and the policy dive verified 34
of the 38 flags against the live MassTransfer search on 2026-09-07 (the 4 Greenfield maps have since
vanished). So the caveat the claim offers ("whether it was applied consistently by the authors is
unverified") is aimed at the wrong thing: the FLAG is fine. The problem is what the flag did to the
numerator.

## 2. Are the compared quantities defined the same way? No — the A2B flag is also the measuring instrument

### 2.1 The two groups were measured with different instruments (the decisive objection)
The final PDF and the older-repo LaTeX (main.tex lines 267-276) state the data-collection order: A2B
maps were pulled FIRST ("where we could, we manually pulled the CS pathways from the A2B Transfer
Database"); for the remaining pairs the authors turned to the MassTransfer Course Equivalency Database
"and, as a final resort, to the course equivalency databases on the web sites of the individual
universities". The UMass Boston sheet carries the annotation "All of this is unofficial through
transferology, but UMB doesnt have any official transfer stuff". The paper itself says of the unmapped
pairs: "We speculate however that there are more courses that could articulate but are just not
included in the state's A2B Database", and calls the secondary sourcing "laborious and prone to human
error".

So the "A2B" cell means "requirement listed as satisfied on a negotiated, published, whole-degree map";
the "unmapped" cell means "the authors found an equivalency by course-by-course look-up". Those are
different detection procedures with different sensitivity, applied to exactly the two groups being
compared. The 24-point gap is therefore the sum of (a) a real policy effect and (b) a detection
difference, and nothing in these data separates them. A methods reviewer would call this
apples-to-oranges in the numerator, even though the denominator (the university's own requirement
list) is identical across a row.

### 2.2 Direct evidence that map-only ticks inflate the A2B side (VERIFIED)
Upper-division columns can only be ticked when something says a CC course fills them, and for the
non-A2B pairs nothing does:
- Bridgewater COMP 340 and COMP 350: ticked at 10 CCs = exactly the 10 A2B CCs, 0 others.
- UMass Amherst's two "Upper Level Elective (300)" columns: ticked at 11 CCs = exactly the 11 A2B CCs.
- Pooled upper-division coverage: A2B pairs 26.4% vs unmapped 7.5% (unmapped pairs AT the four A2B
  universities 9.0%; the seven non-A2B universities 7.2%).
Decomposing each within-university gap: Bridgewater 31.8 pts = 22.7 lower + 9.1 upper (29% of the gap
is upper-division/map-only); Amherst 18.5 = 9.4 + 9.1 (49%); Fitchburg 15.6 = 12.6 + 3.0 (19%);
Dartmouth 12.7 = 12.4 + 0.4 (3%). The lower-division part is also subject to 2.1, but the upper part
is almost purely the instrument: a map that says "COMP 340 — credit for two of the following based on
transcript review" (Bridgewater P21) produces a tick that an equivalency-database look-up cannot.

### 2.3 "Mechanism" is a causal word for a 4-university cross-section
The pooled 56.9 vs 32.7 compares 38 cells at 4 universities with 127 cells at 11; university
composition alone moves the gap. Controls (VERIFIED, OLS on the 165 cells):
| specification | A2B coefficient, all-level | lower-only |
|---|---|---|
| raw pooled gap | 24.2 | 33.7 |
| university fixed effects | 19.7 | 27.5 |
| university + CC fixed effects | 16.8 (se 2.5) | 23.0 (se 3.6) |
The CC confound is small: at the seven universities with no A2B at all, the four never-mapped CCs
(Bunker Hill, Holyoke, Mount Wachusett, Roxbury) average 29.8 vs 33.3 for the other eleven — a 3.5-pt
CC-quality gap, so Bridgewater's within-university 31.8 is mostly not "bad CCs"; the diff-in-diff
against each CC's own mean elsewhere is 27.5. The direction survives every control; the magnitude
stated (24 pts pooled, 32 within Bridgewater) is 30-45% larger than the controlled estimate, and even
the controlled estimate still contains the 2.1 detection component.

### 2.4 The Lowell sentence is a denominator artefact (VERIFIED composition, INFERRED conclusion)
UMass Lowell's 31 requirement columns include 12 placeholder columns: 4 x "General Elective (any
course)", 4 x "Natural Science Elective", 2 x "Technical Elective (3000 if COMP)" (all lower-division,
all ticked 15/15 by construction — any course satisfies them) plus 2 upper-level electives. Those 10
lower placeholders contribute 32.3 pp of Lowell's 61.7% (the originating dive's own §4 says so). On
named columns only (drop every header containing "elective", applied uniformly to all 11 universities):
| university | named cols (L/U) | named-only coverage | A2B? |
|---|---|---|---|
| Fitchburg | 10/6 | 67.5 | A2B |
| Bridgewater | 9/6 | 49.8 | A2B |
| UMass Amherst | 12/1 | 48.2 | A2B |
| UMass Lowell | 12/7 | **47.7** | no |
| UMass Dartmouth | 14/7 | 43.2 | A2B |
| Worcester | 16/3 | 41.8 | no |
Lowell falls from 2nd to 4th, BELOW two A2B universities, and the placeholder-free A2B split WIDENS to
62.1 vs 30.4 (lower-only 80.5 vs 44.8). The 61.7 the claim cites and the 56.9 it is set against are not
on the same footing: 56.9 is a mean over pairs at universities with 2-2 lower placeholders each, 61.7
is one university with 10. "Shows a dense equivalency database can substitute" is therefore not
supported; on comparable denominators Lowell looks like an ordinary non-A2B university with a
reasonably articulable lower-division core (named lower 75.6%, vs Fitchburg 91.3, Bridgewater 68.1).
There is also no evidence in the workbook about Lowell's source: the only annotation on the sheet is
the UML degree-pathway URL (comment A1) and a "???" (F3); "dense equivalency database" is an inference
with no artefact behind it.

### 2.5 "101 of 270 columns articulate at no CC" mixes construction with failure
Columns: 155 lower, 115 upper. Dead: 20 lower (12.9% of lower) + 81 upper (70.4% of upper). Upper
columns are mostly un-articulable by definition in a 2+2 (the paper keeps them only as a denominator),
and 28 of the 101 dead columns are elective placeholders (mostly "Upper Level Elective"). The claim
discloses the 20, which is the only number that measures articulation failure; the "101 of 270"
headline should not be read as one. It also inherits the column-list quirks the brief already flags
(duplicates such as MCLA's two "Programming in Java II", prerequisites listed as requirements).

### 2.6 Things that are NOT a problem here
Units vs counts: both sides of every comparison in the claim are the same binary course count over the
same row denominator — internally consistent. GE: excluded on both sides. Cohort / supply basis: no such
dimensions exist for MA, so none is mismatched. Vintage: identical across older repo, final repo, and
final PDF (see §1). The claim is intra-state, so none of the cross-state ceiling arguments apply; the
per-university ceiling matters only insofar as the A2B universities' ceilings (50.0-63.6) are not
systematically higher than the non-A2B ones (45.0-72.0).

## 3. Verdict

The arithmetic is right and stable across vintages, but the claim is materially misleading as
stated on three measurement counts: (i) it presents a difference between two groups measured with
different instruments (A2B maps vs course-by-course look-ups) as a pure policy "mechanism", with the
map-only upper-division ticks alone carrying 29-49% of the Bridgewater/Amherst gaps; (ii) it states
uncontrolled gaps (24 / 32 pts) where the sending-and-receiving-controlled estimate is 16.8 / 23.0;
(iii) the Lowell "substitution" sentence rests on a 61.7% that is one-third "any course" placeholder
columns and that drops to 47.7%, below two A2B universities, on the denominator the 56.9% uses.
REFUTED as stated; the surviving claim is below.

## 4. Corrected claim (what survives)

"In the paper's own data (older repo = final repo cells, 165 pairs, GE-excluded course counts; final
PDF cells give the same split) the 38 A2B-mapped pairs average 56.9% vs 32.7% for the 127 unmapped
pairs, and the premium survives sending- and receiving-institution fixed effects at +16.8 pts
all-level / +23.0 lower-only. But A2B maps were also the authors' primary data source, so the split
measures documented articulation, not articulation per se: Bridgewater's and Amherst's upper-division
ticks fall on exactly the A2B set (29% and 49% of those within-university gaps). 20 of 155
lower-division columns are dead at every CC; the 81 dead upper-division columns are largely dead by
construction. UMass Lowell's 61.7% includes 10 'any course' placeholder columns at 100%; on named
columns it is 47.7%, below Bridgewater (49.8) and Amherst (48.2), so it does not show an equivalency
database substituting for A2B."
