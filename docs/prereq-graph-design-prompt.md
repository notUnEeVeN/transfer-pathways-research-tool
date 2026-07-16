# Prompt for a design session — prerequisite concept graph

Copy everything below the line into a fresh Claude session (claude.ai or Claude Code with design skills). It is self-contained — no repo access needed. Paste any screenshots of the current view alongside it if you have them; that helps a lot.

---

I need a visual redesign of a prerequisite-graph view in an internal research console, and working React/SVG code for it. Please act as a data-visualization designer first (propose the design, explain the reasoning), then implement it.

## What the view is

A research tool for California community-college → university transfer pathways. We model course prerequisites as a small DAG of ~41 canonical "concepts" (Calculus I, Linear Algebra, CS1, General Chemistry I, …), each belonging to a discipline (math, physics, chem, cs, bio, engr, stats, other). Edges mean "requires": an arrow from calc_1 to calc_2 means Calculus II requires Calculus I. Researchers use this view to *understand and edit the model* — they need to instantly see what leads to what, spot wrong edges, and notice gaps. There are two modes:

1. **Canonical mode** — the ~41 concepts and ~30 rule edges (data below).
2. **College mode** — the same layout logic but nodes are a specific college's actual courses (e.g. "MATH 216 — Differential Equations and Linear Algebra"), typically 20–60 nodes, edges projected from the concept rules.

## The actual data (canonical mode)

Format: `slug | discipline | display name | requires`. A few concepts also "satisfy" others (combined courses) — shown as `sat:`.

```
calc_1|math|Calculus I|req:-
calc_2|math|Calculus II|req:calc_1
calc_3|math|Calculus III (multivariable)|req:calc_2
linear_alg|math|Linear Algebra|req:calc_3
diff_eq|math|Ordinary Differential Equations|req:linear_alg
discrete_math|math|Discrete Mathematics|req:calc_1
bus_calc_1|math|Applied/Business Calculus I|req:-
bus_calc_2|math|Applied/Business Calculus II|req:bus_calc_1
stats_calc|stats|Calc-Based Probability & Statistics|req:calc_2
intro_stats|stats|Introductory Statistics|req:-
phys_mech|physics|Physics: Mechanics (calc-based)|req:calc_1
phys_em|physics|Physics: E&M (calc-based)|req:phys_mech,calc_2
phys_waves_thermo|physics|Physics: Waves/Thermo/Optics|req:phys_em
phys_modern|physics|Physics: Modern|req:phys_waves_thermo
phys_gen_1|physics|General Physics I (algebra-based)|req:-
phys_gen_2|physics|General Physics II (algebra-based)|req:phys_gen_1
gen_chem_1|chem|General Chemistry I|req:-
gen_chem_2|chem|General Chemistry II|req:gen_chem_1
organic_chem_1|chem|Organic Chemistry I|req:gen_chem_2
organic_chem_2|chem|Organic Chemistry II|req:organic_chem_1
cs_1|cs|Programming Fundamentals (CS1)|req:-
cs_2_oop|cs|OOP / CS2|req:cs_1
cs_3_data_structures|cs|Data Structures & Algorithms (CS3)|req:cs_2_oop
comp_arch_assembly|cs|Computer Org & Assembly|req:cs_1
c_systems_programming|cs|C / Systems Programming|req:cs_1
digital_logic|engr|Digital Logic Design|req:cs_1
bio_cell_molec|bio|Cell & Molecular Biology|req:-
bio_organismal|bio|Organismal Biology|req:bio_cell_molec
human_physiology|bio|Human Physiology|req:bio_cell_molec,gen_chem_1
engr_circuits|engr|Intro Circuit Analysis|req:phys_em,diff_eq
engr_programming|engr|Programming for Engineers|req:calc_1
engl_comp_1|other|English Composition 1|req:-
engl_comp_2|other|English Composition 2|req:engl_comp_1
public_speaking|other|Public Speaking|req:-
econ_micro|other|Microeconomics|req:-
econ_macro|other|Macroeconomics|req:-
acct_financial|other|Financial Accounting|req:-
intro_lit|other|Intro to Literature|req:engl_comp_1
world_lit_1|other|World Literature I|req:engl_comp_1
world_lit_2|other|World Literature II|req:engl_comp_1
linear_alg_diff_eq|math|Linear Alg + Diff Eq (combined)|req:calc_3|sat:linear_alg,diff_eq
```

Note the structure: one long math spine (calc_1→calc_2→calc_3→linear_alg→diff_eq) that physics/engineering hang off cross-discipline; several independent 2–4-node chains (chem, bio, CS, English); and ~8 isolated no-edge concepts.

## What we have now (and why it's not good enough)

A hand-built layered SVG: longest-path layering into columns, a barycenter pass to reduce crossings, cubic-bezier edges from node right-edge to node left-edge, 176×46 rounded-rect nodes with name + discipline sub-label, colors via CSS variables. Isolated concepts render as a chip list below the SVG. Problems:

- Edges still overlap and weave where the math spine fans out into physics/engineering; cross-discipline edges (calc_2 → phys_em, diff_eq → engr_circuits) are hard to follow.
- Everything competes for the same vertical space; disciplines are interleaved so the eye can't group them.
- Multi-parent nodes (phys_em, engr_circuits, human_physiology) are where comprehension matters most and where the current view is weakest.
- No interaction: you can't focus on one chain.

## Hard constraints

- React 19 functional components, plain SVG (or HTML/CSS) — **no chart/graph libraries** (no d3, dagre, elkjs, reactflow). The layout algorithm must be hand-written and deterministic.
- Theme-aware: color ONLY via CSS custom properties with fallbacks, e.g. `fill='var(--color-surface, #fff)'`, `stroke='var(--color-border-strong, #8a8a8a)'`. Available semantic vars: `--color-surface`, `--color-canvas`, `--color-border`, `--color-border-strong`, `--color-ink`, `--color-ink-subtle`, `--color-primary` (dark forest green), `--color-accent` (lime), `--color-success`, `--color-danger`. Geometry may be inline attributes/styles.
- Accessibility: every node and edge gets a `<title>`; nothing may be reachable only by hover (a table listing all rules exists below the graph and stays).
- The container is ~1350px wide with `overflow-x: auto` allowed; vertical height should stay reasonable (~600–800px for canonical mode).
- Data arrives as `concepts: [{slug, name, discipline, requires: [slug], satisfies: [slug], note}]` and `rules: [{from, to}]`. College mode arrives as `courses: [{key, prefix, number, title, concept}]` + `edges: [{from, to}]`.

## What I'd like you to explore (designer's judgment welcome)

- **Discipline swim-lanes or bands** (horizontal lanes per discipline, columns still = prerequisite depth?) so the math spine reads as one row and physics/chem/cs/bio each get their own band, with cross-discipline edges visibly crossing lanes.
- **Edge routing** that stays legible at fan-out points: orthogonal/rounded-elbow routing, per-edge vertical offsets at shared sources, or edge bundling by source.
- **Focus interaction**: click a node → highlight its full ancestor + descendant chain, fade the rest (must degrade gracefully; the rules table remains the no-interaction fallback). Keyboard focusable.
- **Discipline color coding** using the CSS vars above (maybe a colored left-accent bar or dot per node rather than full fills, to survive both themes).
- The `satisfies` relationship (combined courses) needs a distinct visual treatment — it's an equivalence-ish link, not a prerequisite arrow.
- Handling both modes with the same component, and staying legible at 60 nodes in college mode.

## Deliverable

1. A short design rationale (what layout model you chose and why, how it handles the fan-out points and cross-discipline edges).
2. Complete, drop-in React component code (single file, no external deps) implementing it: layout function + SVG rendering + the focus interaction. Use mock data wiring so it runs standalone; I'll adapt the data plumbing.
3. Note any trade-offs and what to tweak if college mode (60 nodes) gets crowded.
