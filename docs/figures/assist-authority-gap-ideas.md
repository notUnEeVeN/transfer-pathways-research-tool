# ASSIST "authority gap" — visualization & interpretation backlog

Ideas for figures/analyses that complement the ASSIST-stated-minimums variant
(see [`paper-credit-loss.md`](paper-credit-loss.md)). These probe the central
question: **ASSIST is the nominal source of truth for transfer requirements, but
how operationally reachable are the minimums it states?** Nothing here is built
yet — this is a menu to pick from.

## The thesis

Under ASSIST's own stated minimums, only **~57% of campus×district pairs are
reachable** (367 of 648 = 72 districts × 9 campuses) — and that is the
*corrected, generous* choose-N reading. The naive "every listed receiver must
articulate" reading (the bug we fixed) understated it to **193 / 648 (30%)**.
The gap between "what ASSIST says you need" and "what any college in your
district can actually deliver" is the story.

Baseline numbers (post-fix, 2025–26 snapshot):

| Campus | Reachable districts (of 72) | 1st-choice avg |
| --- | ---: | ---: |
| UCM | 69 | 6.78 |
| UCB | 69 | 3.81 |
| UCR | 62 | 6.84 |
| UCSB | 49 | 7.00 |
| UCSC | 46 | 5.07 |
| UCI | 43 | 5.28 |
| UCD | 28 | 8.68 |
| UCSD | 1 | 7.00 |
| UCLA | 0 | 0.00 |

Only UCLA is fully unreachable — blocked in all 72 districts by a single lab,
`COM SCI 35L`.

---

## Ideas

Each tagged with **what it shows**, **why it's novel**, **data readiness**
(already computed / small new pass / new analysis), and rough **effort**.

### A. The authority gap (headline framing)
- **Shows:** per campus, a slope/dumbbell from *website-minimum reachable
  districts* → *ASSIST-minimum reachable districts*. How much stricter "the
  source of truth" is than the paper's curated website set. Some campuses barely
  move (UCM, UCSB); UCLA collapses to 0.
- **Novel:** reframes the paper's credit-loss result as a *reliability-of-ASSIST*
  result.
- **Data readiness:** already computed — both demand modes are in
  `paper-credit-loss.assist.json` / `.ours.json`.
- **Effort:** low (one chart over existing data).

### B. Anatomy of a block, by grain (newly possible)
- **Shows:** stacked bar per campus decomposing *why* it's unreachable into
  `must-take course / choose-N shortfall / series`. Examples that exist today:
  - **Single keystone course** — UCLA blocked in all 72 by `COM SCI 35L`.
  - **Systemic choose-N gap** — UCSD `1 of [CSE 15L / CSE 29]` blocks 71: a
    "pick one" where *both* options are unarticulated everywhere. ASSIST's
    flexibility is illusory here.
  - **Series wall** — `I&C SCI 31 + 32 + 33` as one indivisible receiver.
- **Novel:** only possible after the fix — the old rule couldn't distinguish a
  killer must-take from a choose-N shortfall.
- **Data readiness:** the blocker adapter already emits `grain`
  (`articulation_blockers` in `analysis/pmt_eligibility.py`); the CSV currently
  flattens it to a string. Surface the grain column → done.
- **Effort:** low.

### C. Keystone / counterfactual map (highest actionable utility)
- **Shows:** rank university courses by **how many (campus, district) cells they
  would unlock if articulated.** "If `COM SCI 35L` articulated in every district,
  UCLA goes 0 → N." A priority list for the articulation system.
- **Novel:** turns a descriptive gap into a constructive to-do — the truth is
  reachable, gated by a countable handful of missing articulations.
- **Data readiness:** small new pass — re-run articulability toggling one blocker
  on at a time over the per-agreement structure we already build.
- **Effort:** medium.

### D. Fragility / slack (minimums met, but barely) — strongest research angle
- **Shows:** for every reachable cell, the **margin** = how many articulations
  could be lost before it flips to blocked. "Choose 1 of 5, all articulate" is
  robust; "choose 1 of 2, one articulates" is one bad year from failing. Heatmap
  tinted by fragility.
- **Novel:** a direct critique of treating ASSIST minimums as stable ground —
  many are technically met but structurally precarious.
- **Data readiness:** computable from choose-N slack (`articulated_count − need`
  per section) in the ported eligibility structure.
- **Effort:** medium.

### E. Student reachability frontier
- **Shows:** flip the P(9,4) machinery to the student — at district D, how many
  of the 9 campuses stay *simultaneously* viable under ASSIST minimums? A
  distribution of districts by "campuses reachable," and how it drops vs the
  website-minimum world.
- **Novel:** the human-facing utility of ASSIST.
- **Data readiness:** the permutation machinery already produces multi-campus
  reachability per district.
- **Effort:** medium.

### F. The correction itself (methodological / meta)
- **Shows:** per-campus before/after (193 → 367; UCB 0 → 69), i.e. how many
  "phantom blocks" the naive every-receiver reading invented.
- **Novel:** doubles as validation of the fix and as an argument that *how you
  read ASSIST matters as much as ASSIST itself*.
- **Data readiness:** both numbers are in hand.
- **Effort:** low.

---

## Recommended first builds

1. **C — keystone/counterfactual** (actionable punch).
2. **B — blocker anatomy by grain** (newly possible; directly indicts ASSIST
   reliability).
3. **A — authority gap** (headline framing).

**D (fragility)** is the strongest *novel research* angle if depth beats breadth.

Delivery choice per idea: a new panel in `frontend/src/analyses/` (interactive,
alongside `PaperDistrictHeatmap`) vs. a static paper figure. A/B/F are cheap
static figures; C/D/E are better interactive.
