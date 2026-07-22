/**
 * One-time seed backlog for the research portfolio: the remaining CA
 * paper figures ported to our data (Figs 1–4 are already the credit-loss,
 * district-heatmap, articulation-histogram, and articulation-map analyses)
 * and the MA paper's seven figures recomputed on the ASSIST dataset. Plain
 * tasks — title + description, seeded into To do.
 */

const seed = (source, fig, title, description) => ({
  title: `${source} Fig. ${fig} — ${title}`,
  description,
  task_type: 'porting',
  status: 'todo',
})

export const SEED_TASKS = [
  // ── CA paper (Jiang et al.) — the figures not yet ported ──
  seed('CA', 5, 'Which requirements block transfer at each campus',
    'Per required course (Calculus, Intro Programming, Data Structures, …), the share of districts missing an articulation at each UC.'),

  // ── MA paper — recreated on the California system with our data ──
  seed('MA', 1, 'Share of each UC’s requirements met at every CC',
    'Heatmap: percent of each campus’s CS requirements with an articulated equivalent at every community college.'),
  seed('MA', 2, 'Articulated courses by category',
    'Distribution of articulated requirements across categories — computing, math, science, non-STEM.'),
  seed('MA', 3, 'Transfer credit rate',
    'Share of community-college credits that transfer toward each campus’s CS degree.'),
  seed('MA', 4, 'Extra credit hours a transfer student needs',
    'Credit hours above the standard degree total that the transfer pathway requires.'),
  seed('MA', 5, 'Extra cost of transferring',
    'The extra credit hours priced with the curated per-campus tuition data.'),
  seed('MA', 6, 'Curricular complexity — transfer vs resident',
    'Complexity difference (blocking/delay factors) between the transfer pathway and the resident degree.'),
  seed('MA', 7, 'Per-campus transfer outcomes summary',
    'One row per campus — credit rate, extra hours, extra cost, complexity delta.'),
]
