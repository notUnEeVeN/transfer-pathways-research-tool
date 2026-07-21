/**
 * Frozen editorial content for the first read-only research showcase.
 *
 * The headline values deliberately do not come from the signed-in viewer's
 * live API scope. That keeps a weekly presentation stable and auditable. The
 * full visuals opened from the showcase remain live, and are labeled as such.
 */

export const SHOWCASE_SNAPSHOT = {
  compiledOn: 'July 20, 2026',
  assistRefreshedOn: 'July 11, 2026',
  label: 'Working research snapshot',
}

export const SCOPE_METRICS = [
  { value: '115', label: 'California community colleges' },
  { value: '9', label: 'University of California campuses' },
  { value: '2,415', label: 'transfer agreements in the source corpus' },
  { value: '114', label: 'colleges with an analyzable computing degree' },
]

export const SHOWCASE_FINDINGS = [
  {
    id: 'complete-paths',
    analysisId: 'category-gaps',
    status: 'Working finding',
    metric: '5 of 9',
    title: 'A typical district has complete paths to five of nine UC computer science programs',
    description: 'Current ASSIST requirements produce 356 complete district and campus paths out of 648. Twenty three districts reach all seven campuses that have any complete path. Gaps in three course requirements close UCLA and UC San Diego statewide.',
    question: 'How many selected UC computer science programs can a student fully prepare for within each community college district?',
    scope: '72 districts and 9 selected programs',
    method: 'Uses each selected program’s current required ASSIST groups and counts a district as complete when its member colleges collectively cover every required group.',
    preview: 'complete-paths',
    actionLabel: 'Explore the course gaps behind this finding',
    liveNote: 'The related live view groups missing articulation by course category. It explains the blockers behind this finding rather than recreating the frozen district count.',
  },
  {
    id: 'transferable-coverage',
    analysisId: 'coverage-heatmap',
    status: 'Live measure',
    metric: 'Unit weighted',
    title: 'Potential graduation-unit coverage reflects the size of each requirement',
    description: 'The live heatmap shows what share of each UC graduation plan’s modeled units has a community-college equivalent. It calculates quarter and semester programs in their own native units and keeps requirement-slot counts as secondary context.',
    question: 'How many modeled UC graduation units have a community-college equivalent?',
    scope: '1,035 college and campus pairs',
    method: 'Divides modeled graduation units with a community-college equivalent by all modeled graduation units for the receiving UC program.',
    preview: 'requirement-coverage',
    actionLabel: 'Explore graduation-unit coverage by college',
    liveNote: 'This live unit-weighted measure replaces the incompatible frozen slot percentage. A replacement snapshot has not been frozen yet.',
  },
  {
    id: 'paired-degrees',
    analysisId: 'transfer-credit-rate',
    status: 'Working finding',
    metric: '9.5 points',
    title: 'The transfer degree aligns better at the same colleges',
    description: 'Among 21 semester system colleges with both degree types, the modeled credit rate is 66.3% for the Computer Science Associate Degree for Transfer and 56.8% for the local Computer Science associate degree.',
    question: 'When a college offers both degrees, how much of each one counts toward the same nine UC graduation plans?',
    scope: '21 matched colleges and 9 UC campuses',
    method: 'Keeps the college set and unit system fixed, then applies the same articulation and graduation requirement model to both degree types.',
    preview: 'paired-degrees',
    actionLabel: 'Explore degree credit by college',
    liveNote: 'The related live view shows the full local and transfer degree cohorts. The 21 college semester comparison is a prepared matched slice, so its values do not appear as the default live filter.',
  },
]

export const DEGREE_COMPARISON = [
  {
    label: 'Local computer science associate degree',
    colleges: 'The same 21 semester system colleges',
    creditRate: '56.8%',
    extraUnits: '+25.8',
  },
  {
    label: 'Computer science Associate Degree for Transfer',
    colleges: 'The same 21 semester system colleges',
    creditRate: '66.3%',
    extraUnits: '+16.6',
  },
]

export const LIMITATIONS = [
  'Degree estimates remain provisional while direct source record review continues.',
  'District completeness reflects the combined offerings of member colleges, not a promise that one college offers the entire path.',
  'Some general education credit uses an explicit optimal student assumption when a verified transfer pattern is not available.',
  'The denominator counts prescribed degree units, not every elective a student could take.',
  'Quarter and semester unit results are kept separate in the matched comparison.',
  'Additional units are a modeled burden, not observed student time to degree.',
]

export const WEDNESDAY_QUESTIONS = [
  'How did the original team treat course series, partial articulations, and requirements that cross groups?',
  'Which requirement source did they consider authoritative when university websites and ASSIST differed?',
  'Which assumptions should remain identical before we compare Massachusetts and California results?',
]

export const WEEKLY_REVIEW_QUESTIONS = [
  'Which California finding should lead the next research update?',
  'Which source record or modeling assumption deserves the next round of verification?',
  'What would make this research update easier to discuss with a nontechnical audience?',
]

export const SHOWCASE_HERO = {
  eyebrow: 'California transfer pathways research',
  title: 'Your three figures, rebuilt on California data',
  lede: 'Same questions, same modelling choices, a different state: 115 community colleges, nine UC computer science programs, and current ASSIST agreements behind every cell.',
}

/**
 * The Massachusetts ports, in the paper's own figure order.
 *
 * Only figures that reproduce the MA paper belong here. The district and
 * credit-loss figures reproduce Jiang et al.'s California study and are
 * presented separately as our own California work — see CALIFORNIA_WORK.
 */
export const FEATURED_FIGURES = [
  {
    id: 'figure-coverage',
    analysisId: 'coverage-heatmap',
    figureLabel: 'Figure 1',
    star: 'Live measure',
    starLabel: 'unit-weighted coverage by college and UC program',
    claim: 'Potential graduation-unit coverage reflects the size of each requirement.',
    blurb: 'Each cell shows the share of a UC computer science graduation plan’s modeled units that has a community-college equivalent. Quarter and semester programs stay in their own native units; slot counts remain secondary detail.',
    method: 'Divides modeled graduation units with a community-college equivalent by all modeled graduation units for the receiving UC program.',
    actionLabel: 'Open the full coverage heatmap',
    liveNote: 'The prior showcase percentage counted slots and is not comparable to this unit-weighted measure. No replacement percentage is frozen yet.',
  },
  {
    id: 'figure-credit-rate',
    analysisId: 'transfer-credit-rate',
    figureLabel: 'Figure 3',
    star: '66.3%',
    starLabel: 'of a transfer degree counts toward the UC degree',
    claim: 'The transfer degree carries roughly ten points more credit than the local degree at the same colleges.',
    blurb: 'Switch the degree type above the figure to compare them. Holding the colleges and the unit system fixed, the Associate Degree for Transfer reaches 66.3% against 56.8% for the local computer science degree.',
    method: 'Applies the same articulation and graduation requirement model to both degree types at the same colleges.',
    actionLabel: 'Open the full credit rate figure',
    liveNote: 'The live figure shows the full local and transfer cohorts, not only the matched college slice.',
  },
  {
    id: 'figure-extra-units',
    analysisId: 'transfer-extra-units',
    figureLabel: 'Figure 4',
    star: '+16.6',
    starLabel: 'units of a transfer degree may need replacing after transfer',
    claim: 'Even the better-aligned degree leaves about a semester of coursework that does not carry.',
    blurb: 'The same comparison read as units rather than percentages. The local degree leaves 25.8 units to replace; the transfer degree leaves 16.6. Darker cells are the college and campus pairs where the most work is repeated.',
    method: 'Replacement units are the associate degree total minus the units that apply to graduation — a modeled burden, not observed time to degree.',
    actionLabel: 'Open the full replacement coursework figure',
    liveNote: 'The live figure reads the current working model and may move after the frozen snapshot.',
  },
]

/**
 * Our own California work, kept clearly separate from the MA ports. The
 * district heatmap reproduces Jiang et al.'s California figure, so presenting
 * it as one of "your figures" would misattribute it.
 */
export const CALIFORNIA_WORK = {
  eyebrow: 'Our California work',
  heading: 'The same machinery answers California’s own question',
  star: '5 of 9',
  starLabel: 'UC computer science programs a typical district can fully prepare for',
  claim: 'Gaps in three course requirements close UCLA and UC San Diego to every district in the state.',
  blurb: 'This figure follows the California study we started from, rebuilt on current ASSIST requirements rather than a scraped snapshot. A district counts as complete when its colleges collectively cover every required group.',
  analysisId: 'paper-district-heatmap',
  method: 'Uses each program’s current required ASSIST groups and counts a district as complete when its member colleges collectively cover every required group.',
  actionLabel: 'Open the full district heatmap',
  liveNote: 'The live heatmap reads current agreements and may move after the frozen snapshot.',
}

export const AUDIT_STORY = {
  intro: 'Every figure above rests on parsed ASSIST agreements. The audit measures how much that parse can be trusted, and publishes the bound instead of a promise.',
  steps: [
    {
      id: 'corpus',
      label: 'Source corpus',
      stat: '2,415',
      statLabel: 'transfer agreements in the source corpus',
      body: 'Current ASSIST articulation agreements between 115 California community colleges and the University of California campuses, refreshed July 11, 2026.',
    },
    {
      id: 'templates',
      label: 'Template collapse',
      stat: '47',
      statLabel: 'exact template shapes span all 1,035 agreements in the nine selected pathways',
      body: 'Agreements parse into exact requirement templates. One human review covers every agreement whose ASSIST source structure is byte-identical, so a small number of careful reviews covers the whole selected corpus.',
    },
    {
      id: 'review',
      label: 'Complete review',
      stat: '47 of 47',
      statLabel: 'template variants have a current human review',
      body: 'A person compared the parser result against the ASSIST source structure for every template shape in the working dataset.',
      facts: [
        '46 reviews matched exactly',
        '1 asked for more coursework than ASSIST requires',
        '0 omitted required work — no student would be left underprepared',
        '48 stored reviews still match current parser output',
      ],
    },
    {
      id: 'bound',
      label: 'Statistical bound',
      body: 'A uniform random sample of templates gives a finite-population Wilson 95% upper bound on the rate of any deviation from ASSIST. We report the ceiling, not the observed rate alone.',
    },
  ],
  bound: {
    // Read these off the live Audit → Stats page (MismatchGauge) at snapshot
    // time and fill them together. Never estimate them.
    //
    // Measured 2026-07-21 against the live audit, unfiltered scope:
    //   ceiling 55.8%, observed 0%, 0/3 random clusters,
    //   ≤ 1348 of 2415 docs, 82 templates.
    // Deliberately not published: the uniform random sample is only 3
    // templates, so the ceiling is far too wide to support a credibility
    // claim, and that scope spans 82 templates rather than the 47 in the
    // nine selected pathways this showcase describes. Publish once the
    // random sample is large enough for the bound to mean something.
    ceilingPct: null,
    observedPct: null,
    k: null,
    n: null,
    estMax: null,
    totalDocs: null,
    pendingNote: 'Bound values are frozen from the live audit at each snapshot. This snapshot has not recorded them yet.',
  },
}

export const DEGREE_READINESS = [
  { value: '199 of 199', label: 'stored degree records retain a catalog source and year' },
  { value: '97.8%', label: 'local degree course references link to ASSIST' },
  { value: '97.1%', label: 'transfer degree course references link to ASSIST' },
  { value: '95.3%', label: 'pathway courses have a prerequisite category mapping' },
]

export const PREREQ_EXHIBIT = {
  // null renders the canonical concept graph; viewers can switch to any
  // college live. Set a source_id here to open on a specific college.
  initialCollegeId: null,
  heading: 'Beyond coverage: the prerequisite structure inside the pathway',
  body: 'Articulation coverage says whether an equivalent course exists. Our concept graph also models what each course requires, per college, and shows the chain-relevant concepts a college has no course for.',
}

export const PLATFORM_SURFACES = [
  {
    id: 'degrees',
    title: 'Per-college degree pages',
    body: 'Every analyzable computing degree, with its catalog source, course list, and how each course maps to ASSIST and to prerequisite concepts.',
  },
  {
    id: 'audit',
    title: 'Audit workbench',
    body: 'Random-sample reviews, verdict tracking, and live statistical bounds over the parsed corpus — the numbers in this showcase come from here.',
  },
  {
    id: 'visuals',
    title: 'Visuals gallery',
    body: 'Published, dated figures with per-account release control. Everything you saw above is a live view, not a screenshot.',
  },
  {
    id: 'api',
    title: 'Data API',
    body: 'The same scoped endpoints that power these pages are documented and queryable, so results can be reproduced outside the interface.',
  },
]
