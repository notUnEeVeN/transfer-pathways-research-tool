# Showcase redesign: data-strength narrative for the Massachusetts group

**Date:** 2026-07-21
**Status:** Approved by Tybalt (2026-07-21, brainstorming session)
**Audience for the page:** the Massachusetts transfer-pathways research group whose paper figures we port, viewed two ways: (1) Tybalt drives it on a Zoom screen-share, (2) the group later receives gated access and explores it alone.

## Problem

The current gated showcase ([frontend/src/showcase/ShowcasePage.jsx](../../../frontend/src/showcase/ShowcasePage.jsx)) is findings-led: hero question, three frozen research findings, a mid-page audit section, limitations, and meeting questions. For the Massachusetts audience the wrong thing leads. They care first about whether our replication of their figures is credible, then about the data machinery behind it, then about what we have that they don't. The audit stats exist on the page but are static, buried, and unexplained; the prerequisite-graph work and the platform itself do not appear at all; the "interactive" surface is limited to small hand-drawn previews.

## Goal

Restructure the showcase into a five-act narrative that demonstrates the strength of the data, the rigor of the audit process, and the depth of the front end — with the real interactive components embedded in-page, working both for a live Zoom walkthrough and for unattended exploration.

## Decision (approaches considered)

- **A. Restructure the existing ShowcasePage** — keep the frozen-snapshot content convention, presentation mode, and per-analysis gating; reorder and rebuild sections. **Chosen.**
- B. Keep the findings showcase and add a separate methods page — rejected: splits the story across tabs, bad for a single screen-share walkthrough.
- C. Rebuild from scratch as a scrollytelling page — rejected: discards working machinery (FullScreenPanel presentation mode, gating, frozen-content pattern) for cosmetic gain.

## The five acts

Order is the message: replication credibility → data trustworthiness → beyond the paper → the platform → discussion.

### Act 1 — "Your figures, our state" (replication credibility)

- Hero reframed for the Massachusetts audience: California statewide port of their methodology, working-snapshot date retained.
- An interactive **figure stage** reusing the existing `FindingStage` selector pattern (numbered rail on the right, one large stage) but the stage renders the **actual live analysis components** from [frontend/src/analyses/registry.js](../../../frontend/src/analyses/registry.js) — not static previews.
- Featured figures, in rail order: `paper-district-heatmap` (their Fig. 1 form), `transfer-credit-rate` (their Fig. 3), `transfer-extra-units` (their Fig. 4), `coverage-heatmap`. Each entry carries: paper provenance label ("Massachusetts paper, Fig. 3 — on California data"), the frozen headline number from `showcaseContent.js`, and the standard live-visual caveat.
- The three existing frozen findings (complete paths, transferable coverage, paired degrees) remain as additional rail entries after the figure ports — they are the payoff of the data, not the lead.
- Full-screen open behavior for any stage entry is kept (existing `FullScreenPanel` + method/question sidebar).

### Act 2 — The audit story (why the numbers are trustworthy)

A new interactive **audit stepper**: one horizontal step rail, one explanation stage; clicking a step swaps the stage. Steps, each with a plain-language explanation and a frozen stat:

1. **Corpus** — 2,415 transfer agreements in the source corpus.
2. **Template collapse** — agreements parse into exact requirement-template shapes; 47 shapes span all 1,035 agreements in the nine selected pathways (the leverage stat: one review covers every agreement whose ASSIST source structure is byte-identical).
3. **Complete review** — 47 of 47 template variants human-reviewed; 48 stored reviews still match current parser output; 0 unsafe errors (46 exact, 1 conservative over-ask, none omitted required work).
4. **Statistical bound** — the uniform-random-sample Wilson 95% upper bound on strict mismatch (the "safety percentage"), presented with the same visual language as [MismatchGauge.jsx](../../../frontend/src/pages/Audit/components/stats/MismatchGauge.jsx): ceiling value, observed rate, "≤ N of total docs" translation. Values are **frozen at snapshot compile time** from the live Audit stats page, like every other headline number.

The stepper is a new showcase-local component; it does not import the Audit page's components (those read live scoped hooks) but may share visual idioms. All numbers live in `showcaseContent.js`.

### Act 3 — Beyond the paper (prerequisite graphs + degree records)

- Embed a live **`ConceptGraphView`** ([frontend/src/prereqs/ConceptGraphView.jsx](../../../frontend/src/prereqs/ConceptGraphView.jsx)) as an interactive exhibit, mounted with `initialCollegeId` set to one well-chosen college (a college with a rich mapped-course graph — implementer picks the strongest example from the dev data and records the choice in `showcaseContent.js`) and `lockCollege={false}` so viewers can switch colleges live.
- Framing copy: the paper's approach models articulation coverage; ours additionally models the prerequisite concept structure inside the pathway, per college, including gap chips for chain-relevant concepts a college lacks.
- Alongside: the degree-record depth stats currently in the "Degree data readiness" strip (199 of 199 sourced degree records, 97.8% / 97.1% ASSIST-linked course references, 95.3% prerequisite-category mapping), kept frozen.

### Act 4 — The platform (front-end power)

- A compact band presenting the tool as a living research instrument, not a one-off analysis: the per-college degree pages, the audit workbench, the visuals gallery, and the data API.
- Format: 4 cards, each with a title and a one-to-two-sentence description; no live embeds here (these surfaces are gated and stateful). Cards are text-first; screenshot thumbnails can be added later by Tybalt as committed assets without structural change.
- The existing **ScopeBand** (115 community colleges, 9 UC campuses, corpus counts, ASSIST refresh date) merges into this act as its closing strip.

### Act 5 — Discussion

- Keep the `MeetingQuestions` section (Wednesday questions for the Massachusetts team + weekly review questions), trimmed to the Wednesday list plus the snapshot footer. The weekly professor list moves out of the MA-facing narrative but stays in `showcaseContent.js` for the internal weekly view if wanted later.

## What is removed or moved

- `ConfidenceSection` (current static audit cards) — superseded by Act 2's stepper; its numbers migrate into stepper steps.
- `DegreeComparisonSection` — its content is already finding #3 in the stage; the standalone section is dropped.
- `MethodSection` (evidence labels + limitations) — compressed into a slim "how to read the evidence" strip kept directly after Act 2, retaining the three evidence labels and the limitations list unchanged.
- Static preview components (`CompletePathsPreview`, `RequirementCoveragePreview`, `PairedDegreePreview`) — retained only as instant-render fallbacks for the three findings entries in the stage; the four figure-port entries render live components.

## Constraints and conventions (unchanged)

- **Frozen narrative values**: every headline number is hand-authored in [showcaseContent.js](../../../frontend/src/showcase/showcaseContent.js) with a snapshot date; live embeds are labeled live and may drift from the frozen numbers. New frozen values (Wilson bound, template leverage) are read from the running app at compile time and recorded with the snapshot date.
- **Gating**: showcase visibility stays behind `SHOWCASE_ENABLED`; per-analysis opening stays behind `canViewBuiltInAnalysis`. Embedded live figures in the stage must also respect per-account release state — an unreleased figure renders its frozen fallback preview with the existing "not released for this account" affordance.
- **Presentation mode**: the existing `FullScreenPanel` presentation flow (scroll preservation, nested full-screen visuals) carries over to the new structure unchanged.
- **Read-only**: no editing, task, audit, or publishing controls on the page.
- **Verification notes remain user-authored**: no generated notes anywhere.

## Testing

- Update [ShowcasePage.test.jsx](../../../frontend/src/showcase/ShowcasePage.test.jsx) for the new act structure: acts render in order; the figure stage swaps entries; provenance labels present; stepper steps swap the stage and show frozen values; gated figure falls back to preview when unreleased; presentation mode still opens and restores scroll.
- New content module keys covered by a light shape test (as `showcaseContent` values are load-bearing copy).
- `ConceptGraphView` embed: mock `useColleges`/`usePrereqGraph` as the prereqs tests already do; assert the exhibit mounts with the chosen initial college.

## Out of scope

- No changes to the analyses themselves, the Audit page, the prereqs tab, or server endpoints.
- No public/unauthenticated access changes.
- No new data pipelines; all new numbers are frozen editorial values.
