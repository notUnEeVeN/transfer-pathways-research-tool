# Associate-degree type analysis

**Generated:** 2026-07-18T15:04:41.219Z from the local `pmt_research` database and the 115-school survey artifact.

## Recommendation

For an analysis of **credit loss or alignment between a college's own CS associate degree and UC transfer requirements**, use `local_cs_as` as the primary cohort. Keep `ast` as a separately reported standardized transfer benchmark. Do not pool `local_computing` into either cohort: it combines CIS, IT, networking, cybersecurity, business applications, programming, and a few other CS-named awards, and it has no defensible statewide curriculum template.

The cleanest controlled descriptive comparison available in these data is the **22 schools with both a local CS A.S. and an A.S.-T**. Compare the two degree outcomes within those schools, then show the full 45-school local-CS cohort as the main descriptive estimate and the full 69-school A.S.-T cohort as a benchmark.

Do not build one pooled statewide estimate using a fallback such as local CS A.S. → A.S.-T → local computing. That changes the degree construct from school to school and makes the result difficult to interpret.

## Current analyzable records

| Degree category | Schools | Mean template coverage | Course linkage | Mean extraction confidence | Hand-verified |
| --- | --- | --- | --- | --- | --- |
| Local Computer Science A.S. | 45 (39.1%) | 80% | 97.8% | 0.91 | 0 |
| Computer Science A.S.-T | 69 (60%) | 98.1% | 97.1% | 0.942 | 0 |
| Local computing associate degree | 63 (54.8%) | No valid template | 90.3% | 0.91 | 0 |

The database contains **199** rows with `status: found`. After removing **22** `local_computing` rows that repeat the same local CS A.S. title and exact course set, there are **177 distinct analyzable awards**. None is hand-verified yet. Course linkage is the share of resolved plus unresolved course references that link to canonical ASSIST course IDs. Template coverage is meaningful only for the two CS templates.

## Inventory versus analyzable coverage

The inventory and requirement-level datasets answer different questions:

- The survey finds a local CS A.S. at **45** schools; all 45 have analyzable records.
- The survey finds a CS A.S.-T at **72** schools; **69** currently have analyzable records. The gaps are College of San Mateo, East Los Angeles College, Los Angeles Mission College.
- The survey's non-disjoint `local_computing_degrees` list is nonempty at **107** schools, but the database has only **85** tagged rows. Of those, **22** repeat a local CS A.S., leaving **63** distinct representative local-computing records. The schema stores at most one row per school/type, so this is not an exhaustive program inventory.
- Woodland Community College is the one verified school with no CS-related associate degree and has no stored `as_degree` row.

## School mixes in the requirement-level data

| Analyzable degree mix | Schools |
| --- | --- |
| ast + local_computing | 40 |
| local_cs_as | 22 |
| local_cs_as + ast | 22 |
| local_computing | 22 |
| ast | 7 |
| local_cs_as + local_computing | 1 |
| none | 1 |

These mixes remove the 22 duplicate tags. For credit-loss work, that becomes: **45** schools in the primary local-CS cohort, **47** additional schools with only an A.S.-T benchmark (possibly plus local computing), **22** schools usable only for descriptive local-computing work, and **1** school with no degree.

## Why the types should not be pooled

- **Local CS A.S.** is the construct closest to “complete the college's own CS degree.” Its template coverage averages **80%**, showing meaningful local variation—the variation a credit-loss analysis is meant to study.
- **A.S.-T** is highly standardized: mean template coverage is **98.1%**. It is designed around the statewide transfer curriculum and is therefore a useful contrast, but it is oriented to CSU transfer rather than specifically to UC requirements; UC credit loss should be measured rather than assumed to be low.
- **Local computing** has no statewide template. Even the most common mapped concepts vary widely, and some courses are absent from ASSIST because they are not transferable. Treat it as a family of programs that requires subtyping, not as a third interchangeable CS degree.

## Analysis rules I would use

1. Define the main estimand on `local_cs_as` only (45 schools).
2. Report `ast` separately (69 analyzable schools), explicitly labeling it a standardized transfer benchmark.
3. Use the 22-school paired subset as the strongest degree-type comparison.
4. Exclude `local_computing` from pooled CS estimates. If needed, first subtype it (CS/programming, CIS/business applications, IT/network/security, etc.) and analyze those strata separately.
5. Keep semester and quarter schools separate or convert units before aggregation. Five records use quarter units.
6. Hand-verify the paper's analytic subset. Current confidence is high, but 0/177 distinct records are marked verified and 41 records still contain at least one unresolved course reference.
7. Do not interpret the service's `units_mismatch` flag as missing degree data without review: GE and electives-to-total are often represented as blocks rather than enumerated courses.

## Outputs

- `analysis/results/as_degree_types_by_school.csv` — all 115 colleges, inventory presence, analyzable records, quality fields, and suggested analysis role.
- `analysis/results/as_degree_type_summary.json` — machine-readable aggregate results.
