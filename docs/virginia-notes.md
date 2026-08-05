# Virginia (Transfer Virginia) — parked

Working scraper and a measured fidelity assessment for Virginia's transfer
guides. **Not wired into the application.** Nothing under `server/` or
`frontend/` imports it; deleting this directory removes it completely.

Parked in favour of Maryland (see
[`server/services/artsys/README.md`](../../server/services/artsys/README.md)
and [`docs/maryland-integration.md`](../../docs/maryland-integration.md)).
Kept because the work is done and tested — resuming is roughly a day, not a
restart.

## Why Maryland was chosen instead

Not the number of bugs found. The difference is **what bounds the errors you
have not found yet.**

Maryland renders every guide once per sending college, and the receiving
skeleton must be identical across all 16. That checked the parser against 9,600
renderings for free and returned zero mismatches: a structural parse error
*cannot* hide, because it shows up as disagreement between renderings of the
same guide.

Virginia has no such redundancy — one guide, one rendering, hand-authored by
60+ institutions. Every defect here was found by noticing a number that looked
wrong, and the rate of finding them had not fallen when work stopped. There is
no way to state how many remain.

Two further structural advantages of Maryland:

- Sending and receiving courses are **separate structured fields**, so they
  cannot be confused. Virginia's are two columns of a WYSIWYG table, and some
  guides fill them the wrong way round (below).
- `No equivalency found.` is **published** by ARTSYS. In Virginia, absence has
  to be *constructed* by joining against a course search — a citation versus an
  argument you have to defend.

## What is here

| Path | |
| --- | --- |
| `src/rowGrammar.js` | the prose requirement grammar — per-row `read` / `inferred` / `unparsed` |
| `src/parseGuide.js` | guide HTML → structured requirements |
| `src/fetch.js` | polite cached client + **AWS WAF challenge detection** |
| `src/courseSupply.js` | per-college course availability via the Solr institution facet |
| `src/*.test.js` | 42 tests, every case a real corpus string |
| `scripts/_va_*.js` | fidelity, code-inventory, parenthetical and supply probes |
| `fixtures/` | a real guide (Longwood CS BA/BS) |
| `cache/` | 1,159 crawled pages (gitignored, regenerable) |
| `virginia-feasibility.md` | the original feasibility review |

The tests live outside `server/`, so the server suite does not run them — which
is the point: parked code should not gate CI.

`rowGrammar` and `fetch` (29 tests) run standalone. `parseGuide` needs
`cheerio`, which lives in `server/node_modules`, so on resume either move this
directory back under `server/` or add a `package.json` here:

```bash
cd deprecated/virginia && npx vitest run --root . src   # 29 pass, parseGuide needs cheerio
```

All 42 passed before the move, under `server/`.

## Measured fidelity — demand side (complete)

```
544 guides · 542 parsed · 29 universities · 9,224 requirement rows · 12,322 code references

course rows      69.43%      unparsed    2.70%   (272 rows, retained verbatim)
category rows    27.87%      inferred   12.00%   (prefix_carry · slash_alternatives · parenthetical_codes)
                                        541      table summary rows, excluded from the denominator
```

Supply side crawled (586 distinct codes, 0 blocked, 0 errors) but **the join was
not built** — see the blocker below.

## The five traps this corpus produced

Each returned a plausible number rather than an error. They are listed because
any resumption will meet more of them.

1. **AWS WAF challenges served as HTTP 200.** A ~2KB JavaScript challenge page
   cached as content; the parser found no table and reported the guide empty.
   Would have produced *"75% of Virginia guides publish no requirements."*
   Detector in `src/fetch.js`, 5 tests.
2. **Table summary rows counted as requirements.** `Pre-Transfer Credits` was
   41% of the "unparsed" pile — inflating the failure rate fourfold *and*
   corrupting the denominator of every other rate.
3. **Phantom course `OR 101`.** Reading codes case-insensitively (needed for
   `Art 101`) let English words match the prefix pattern, so `SDV 100 or 101`
   fabricated a course. Fixed with a stoplist.
4. **Phantom `CPSC 300`.** The bare-prefix carry added for parenthesised lists
   also fired on free text, turning the level rule *"CPSC course numbered 300 or
   higher"* into a specific course. Now gated.
5. **Fuzzy course search.** `query=CSC 223` returns CSC222 and the institution
   facet counts both. `query=CSC223` is exact. Using the spaced form would have
   inflated every college's apparent inventory.

## The blocker, if this is resumed

**Some guides put the receiving university's course codes in the community
college column.**

```
George Mason   CC column: "Gen Ed: Written Comm ENGH 101"   equivalent column: "ENG 112"   ← reversed
George Mason   CC column: "PHY 201 & PHYS 202 or PHY 241 & PHYS 242"                       ← both, mixed
Bridgewater    CC column: "HIST 102 or HIST 112"                                           ← HIST is not VCCS
```

27 extracted prefixes are not VCCS vocabulary at all (`ARTS BIOL CHEM ENGL MATH
PHYS HIST PHIL ECON GEOL ENGR ENGH …`; VCCS uses `ART BIO CHM ENG MTH PHY HIS
PHI ECO GOL EGR`). This is why 215 of 586 codes resolve to no college.

It also undercuts Virginia's main methodological selling point. The join was
supposed to be *exact* because guides and colleges share VCCS numbering — but an
exact join on the wrong column is a confidently wrong answer, which is worse
than a fuzzy one you know to distrust.

To resume:

1. Build a VCCS prefix whitelist and flag every row whose codes fall outside it.
2. Decide, per guide, whether reversed-column guides are corrected or excluded —
   an editorial judgement about the source, not a technical one. Mixed cells
   (`PHY 201 & PHYS 202`) need their own rule.
3. Then build the join: exact set membership of required codes against each
   college's offerings.

## What Virginia would still be good for

Larger than Maryland — 23 community colleges and 29 receiving institutions
against 16 and 13 — state-run rather than vendor-hosted, and both halves public
without an account.

Its measure is different, not lesser: a Virginia gap means *this college does not
teach the course*, where a Maryland gap means *no articulation exists*. The
Virginia question has obvious economic correlates and is arguably more
fundamental — a college that cannot teach Data Structures blocks the student
whatever the articulation policy says. The two are not poolable.
