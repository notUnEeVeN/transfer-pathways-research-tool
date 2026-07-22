# Comparison layer + state dimension (W2) — design sketch

**Date:** 2026-07-22 · **Status:** direction approved; detailed spec deferred
**Roadmap:** `2026-07-22-expansion-roadmap.md` — sub-project W2.
**Depends on W1** (needs ≥2 majors live) for the comparison half; the state
half is a design-now / build-later abstraction for the MA data. No
implementation plan exists yet — write one after W1 lands and the comparison
questions below are answered with real data in hand.

## Half 1 — Cross-major comparison visuals

**Question to answer:** what does a major's *structure* do to transfer
access? Majors differ along axes our data can measure:

- **Articulation density** — share of required receivers articulated
  (CS ~47% lower-division vs sciences ~87%; where do bio/econ fall?).
- **Prereq-chain depth** — curricular complexity of the minimum plan
  (CS chains through calc; bio chains through chem sequences; econ is
  shallow). Complexity + time-to-degree already compute this per major.
- **Overlap economics** — how much of one major's minimum plan is reusable
  for another (multi-campus machinery answers this if run across majors:
  "cost of keeping both CS and Econ open").
- **Geography of access** — does the income-access gradient replicate for
  bio/econ, and is it steeper or flatter than CS?

Candidate figures (pick after seeing data):
1. **Coverage delta heatmap** — district × campus, colored by
   complete-for-major-A minus complete-for-major-B.
2. **Per-major credit-loss curves** on one axis (1st→4th choice per major).
3. **Category-gap fingerprints** — small multiples per major of the CA-5
   style gap chart, shared scale.
4. **Access-equity comparison** — income-quartile access bars per major.
5. **Cross-major portfolio cost** — joint minimum plan for {CS} vs
   {CS+Econ} vs {CS+Bio} at one campus (extends the subset machinery from
   campus-subsets to major-subsets).

**Architecture:** analysis endpoints already take a major scope (F); the
comparison layer adds endpoints/components that accept `majors: [slug]` and
return per-major series. New components live beside the existing analyses in
the registry with `provenance: 'new'`. No storage changes.

## Half 2 — State dimension (Massachusetts)

**Target:** convert MA data (MassTransfer A2B equivalencies, MA college
catalogs, four-year requirements) into the SAME collections so every
algorithm runs unchanged, then compare CA↔MA on shared measures.

What CA-implicitness must become explicit (inventory from the 2026-07-22
scan):

- `assist_institutions` docs gain `state` (`'ca'` default backfill) and a
  `system` label for the receiving side (UC today; MA state universities /
  UMass later). District/county roll-ups become state-conditional (MA has no
  CCD districts — its grouping unit needs deciding).
- GE machinery: CalGETC/IGETC/CSU-GE areas and Title 5 §55063 constants
  (`asDegreeView.js`, `CanonicalData.js`) become per-state pattern sets
  (MassTransfer Gen Ed Foundation as the MA analog).
- Calendars: the hardcoded CA quarter-college id sets (`pathwayPlanner.js`)
  move into institution docs (`academic_calendar` already exists on
  universities — extend to CCs during the MA import).
- Source-links: assist.org URL builders become per-state (A2B links).
- The majors config gains a per-state scope (a program pin belongs to a
  state's institution universe) — design so a major can exist in both states
  with different pins.

**Conversion approach:** a `scripts/import_ma_*.py` family mirroring the
existing import scripts, producing `assist_agreements`-shaped docs from A2B
equivalencies (the MA papers' manual assembly, structured). Everything gets
provenance fields marking `source_system: 'masstransfer'`.

**Comparison caveat carried from the figure docs:** CA/MA numbers are only
directly comparable where denominators match (the MA Fig-2 denominator
difference is already documented in `docs/figures/ma-course-type-spread.md`)
— the W2 spec must define the shared-denominator variants before any
CA-vs-MA figure ships.

## Open questions for the future detailed spec

1. MA grouping unit (no districts) — college-level only, or county?
2. Which MA receiving institutions are in scope (UMass system only?).
3. Where MA catalog/course data comes from at scale (the MA team's manual
   corpus vs re-scraping).
4. Which comparison figures make the paper vs the console only.
