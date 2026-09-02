/**
 * Per-major metadata that is NOT in the database: which ASSIST program counts
 * as the major at each campus, the free-text match string, the course-category
 * vocabulary, the course-code typing rules, and capability flags.
 *
 * This module is the single source of truth. `services/analysis/pathways.js`,
 * `controllers/Curation.js` and `services/courseTypes.js` read from here rather
 * than holding their own copies.
 *
 * Onboarding a major = port its agreements with scripts/port.py, then add one
 * entry here. The API and Settings coverage inventory discover every entry,
 * campus pin, capability, and category from this registry. Program-pin
 * decisions and exclusions are documented in docs/major-pins.md.
 *
 * It is a JS module rather than a Mongo collection because the values are
 * regexes and because adding a major already requires an admin at a terminal
 * (port.py). Moving it to a collection later is a contained change.
 */
const MAJORS = [
  {
    slug: 'cs',
    label: 'Computer Science (CA)',
    // Human-friendly fallback used only by legacy callers that explicitly ask
    // for a contains search. Analysis requests with majorSlug=cs use the exact
    // campus/program pairs below.
    match: 'computer science',
    // The single canonical CS program analyzed at each campus. These values
    // are byte-identical to Atlas (including Merced's stored trailing space).
    // Alternative CS, CSE, joint, minor, and specialisation programs are not
    // part of this major and must never enter a majorSlug=cs analysis.
    programs: {
      89: ['Computer Science B.S.'],
      144: ['COMPUTER SCIENCE AND ENGINEERING, B.S. '], // trailing space is stored
      7: ['CSE: Computer Science B.S.'],
      128: ['Computer Science, B.S.'],
      117: ['Computer Science/B.S.'],
      79: ['Electrical Engineering & Computer Sciences, B.S.'],
      132: ['Computer Science B.S.'],
      120: ['Computer Science, B.S.'],
      46: ['Computer Science, B.S.'],
    },
    // Ordered cohorts shown by the two associate-degree analysis figures.
    // The local A.S. remains the historical CS headline; A.S.-T is its
    // statewide comparison.
    degreeAnalysisSlots: ['local_as', 'ast'],
    // Audit receipt carried into comparison contracts. Row exports remain the
    // authoritative, per-template evidence; this summary makes the current
    // corpus status visible before comparison data has loaded.
    degreeTemplateEvidence: {
      total: 9,
      explicitlyVerified: 9,
      catalogYears: 'not recorded on the legacy CS templates',
      staleResearchStatus: 0,
    },
    // Canonical course categories for the gap figures, and the broad axes they
    // roll up into. Consumed by controllers/Curation.js.
    categories: [
      { key: 'calculus', axis: 'math' },
      { key: 'advanced_math', axis: 'math' },
      { key: 'discrete_math', axis: 'math' },
      { key: 'other_math', axis: 'math' },
      { key: 'intro_programming', axis: 'computing' },
      { key: 'data_structures', axis: 'computing' },
      { key: 'computer_org', axis: 'computing' },
      { key: 'other_computing', axis: 'computing' },
      { key: 'science', axis: 'science' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['computing', 'math', 'science', 'non_stem'],
    // Course-type figure taxonomy (MA Figure 2 columns, CA Figure 5 panels).
    // Computer Science types through services/courseTypes.js, whose four
    // categories are already the paper's four columns, so the rollup is the
    // identity and there is no extended variant to toggle into.
    courseTypes: {
      module: 'cs',
      // The Massachusetts Figure 2 denominator is degree and college
      // requirements with general education excluded. Keep the California
      // recreation on that same population; GE-inclusive coverage belongs to
      // an explicitly different lens, not the default comparison.
      excludeGeGroups: true,
      axes: {
        faithful: [
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'math', label: 'Math', categories: ['math'] },
          { key: 'science', label: 'Science', categories: ['science'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
    },
    // Which prereq-concept disciplines this major's chains draw on.
    conceptDisciplines: ['math', 'cs', 'physics', 'engr', 'stats'],
    // Explicit roots for the major-scoped prerequisite page. The graph service
    // adds every transitive prerequisite and satisfying compound concept.
    prerequisiteConcepts: [
      'calc_1', 'calc_2', 'calc_3', 'linear_alg', 'diff_eq', 'linear_alg_diff_eq',
      'discrete_math', 'bus_calc_1', 'bus_calc_2', 'stats_calc', 'intro_stats',
      'phys_mech', 'phys_em', 'phys_waves_thermo', 'phys_modern', 'phys_gen_1', 'phys_gen_2',
      'gen_chem_1', 'gen_chem_2', 'organic_chem_1', 'organic_chem_2',
      'cs_1', 'cs_2_oop', 'cs_3_data_structures', 'comp_arch_assembly',
      'c_systems_programming', 'digital_logic', 'engr_circuits', 'engr_programming',
      'bio_cell_molec', 'bio_organismal', 'human_physiology',
      'engl_comp_1', 'engl_comp_2', 'intro_lit',
    ],
    // The typing RULES stay in code — they are regexes and prefix sets, and a
    // major's rules are a module (services/courseTypes.js here,
    // services/courseTypesBio.js for Biology) named by `courseTypes.module`
    // above. This config carries only the rollups the figures render.
    //
    // What this major's data supports. Everything defaults false for a new
    // major; cs has the full historical dataset.
    capabilities: {
      assistAgreements: true,
      // Strict-engine coverage verdicts exist for this major's corpus —
      // the state-agnostic requirement of the coverage matrix/histogram
      // figures (Maryland majors satisfy it through artsys_* data).
      articulationVerdicts: true,
      caCreditLossArtifact: true,
      agreementPathways: true,
      asDegrees: true,
      paperBaselines: true,
      transferMinimums: true,
      degreeTemplates: true,
      // The California unit-budget model (70-unit cap, GE netting) applies.
      unitCoverage: true,
      courseCategories: true,
      // Rule-based receiver typing for MA Figure 2 / CA Figure 5. Distinct
      // from courseCategories, which needs hand-curated per-course tags.
      courseTypeFigures: true,
      prerequisites: true,
      snapshots: ['district-multi-campus-pathways', 'multi-campus-pathways',
        'district-portfolio-subsets'],
    },
  },
  {
    slug: 'bio',
    label: 'Biology',
    match: 'biolog',
    // One program per campus: each campus's umbrella / general biology degree,
    // B.S. where a campus offers both awards. Berkeley has no umbrella degree,
    // so it takes MCB — the larger department and the closest prerequisite
    // match to the other eight. Pins confirmed 2026-07-22; the excluded
    // specializations and the reasoning are in docs/major-pins.md.
    programs: {
      79: ['Molecular and Cell Biology, B.A.'],
      89: ['Biological Sciences B.S.'],
      120: ['Biological Sciences, B.S.'],
      117: ['Biology/B.S.'],
      144: ['BIOLOGICAL SCIENCES, General Biology Emphasis, B.S.'],
      46: ['Biology, B.A. or B.S.'],
      7: ['Biology: General Biology B.S.'],
      128: ['Biological Sciences, B.A. & B.S.'],
      132: ['Biology B.S.'],
    },
    // Confirmed against the nine ported templates on 2026-07-23; these are the
    // fine categories services/courseTypesBio.js assigns, so the curated
    // tagging vocabulary and the figure taxonomy are one list. `axis` is the
    // faithful (four-column) rollup. See docs/figures/bio-course-types.md.
    categories: [
      { key: 'bio_series', axis: 'biology' },
      { key: 'calculus', axis: 'math' },
      { key: 'statistics', axis: 'math' },
      { key: 'computing', axis: 'math' },
      { key: 'gen_chem', axis: 'chem_physics' },
      { key: 'organic_chem', axis: 'chem_physics' },
      { key: 'physics', axis: 'chem_physics' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    // The cohorts the associate-degree figures compare. Biology is a science
    // award like Computer Science, so it uses the same two. The live corpus has
    // 98 found A.S.-T and 57 found local A.S. records; each slot also carries
    // 10 explicit `none_found` sentinels, which are evidence of absence rather
    // than degree records. The 21 found local_other records are too thin a
    // cohort to stand as their own series.
    degreeAnalysisSlots: ['local_as', 'ast'],
    degreeTemplateEvidence: {
      total: 9,
      explicitlyVerified: 9,
      catalogYears: '2025-26 (8 templates); 2026-27 (UC San Diego)',
      // Explicit verification records are authoritative; this count exposes
      // the stale pre-verification label without calling the templates
      // unverified.
      staleResearchStatus: 9,
    },
    broadAxes: ['biology', 'math', 'chem_physics', 'non_stem'],
    // Column order mirrors the Computer Science figure's: own discipline,
    // quantitative, supporting science, everything else. The extended variant
    // exists because the faithful rollup necessarily hides that chemistry is
    // the largest block of a biology degree — 87 course references against
    // biology's ~45 — and the ported figure must not carry an annotation the
    // source figure does not have.
    courseTypes: {
      module: 'bio',
      // Match the source figure's degree/college-requirement denominator:
      // general-education and free-elective padding groups are not course-type
      // observations in this comparison.
      excludeGeGroups: true,
      axes: {
        faithful: [
          { key: 'biology', label: 'Biology', categories: ['bio_series'] },
          { key: 'math', label: 'Math', categories: ['calculus', 'statistics', 'computing'] },
          { key: 'chem_physics', label: 'Chemistry & Physics', categories: ['gen_chem', 'organic_chem', 'physics'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
        extended: [
          { key: 'biology', label: 'Biology', categories: ['bio_series'] },
          { key: 'chemistry', label: 'Chemistry', categories: ['gen_chem', 'organic_chem'] },
          { key: 'physics', label: 'Physics', categories: ['physics'] },
          { key: 'math', label: 'Math', categories: ['calculus', 'statistics'] },
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
      // CA Figure 5's 2x3 panel grid, in reading order.
      barrierPanels: [
        { key: 'bio_series', label: 'Intro Biology' },
        { key: 'gen_chem', label: 'General Chemistry' },
        { key: 'organic_chem', label: 'Organic Chemistry' },
        { key: 'calculus', label: 'Calculus' },
        { key: 'statistics', label: 'Statistics' },
        { key: 'physics', label: 'Physics' },
      ],
    },
    conceptDisciplines: ['math', 'chem', 'bio', 'physics', 'stats'],
    prerequisiteConcepts: [
      'calc_1', 'calc_2', 'calc_3', 'linear_alg', 'diff_eq', 'linear_alg_diff_eq',
      'discrete_math', 'bus_calc_1', 'bus_calc_2', 'applied_math_3',
      'stats_calc', 'intro_stats', 'intro_data_science',
      'phys_mech', 'phys_em', 'phys_waves_thermo', 'phys_modern', 'phys_gen_1', 'phys_gen_2',
      'gen_chem_1', 'gen_chem_2', 'organic_chem_1', 'organic_chem_2',
      'organic_chem_survey_1', 'organic_chem_survey_2', 'organic_biochem_survey',
      'bio_cell_molec', 'bio_organismal', 'human_physiology',
      'bio_genetics', 'biochemistry', 'molecular_biology',
      'cs_1', 'cs_2_oop', 'cs_3_data_structures', 'comp_arch_assembly',
      'c_systems_programming', 'engr_programming',
      'engl_comp_1', 'engl_comp_2', 'intro_lit',
    ],
    capabilities: {
      assistAgreements: true,
      // Strict-engine coverage verdicts exist for this major's corpus —
      // the state-agnostic requirement of the coverage matrix/histogram
      // figures (Maryland majors satisfy it through artsys_* data).
      articulationVerdicts: true,
      caCreditLossArtifact: true,
      // Per-agreement exact-path artifacts still need blocked-path and solver-
      // proof metadata before the exploratory minimum/choice-cost cards are
      // honest for this larger corpus.
      agreementPathways: false,
      // 166 found AS/AS-T records across 105 colleges, imported 2026-07-23.
      asDegrees: true,
      paperBaselines: false,
      // Deliberately permanent: new majors are ASSIST-driven end to end, so
      // there are no hand-curated website minimums to gather.
      transferMinimums: false,
      degreeTemplates: true,
      // The California unit-budget model (70-unit cap, GE netting) applies.
      unitCoverage: true,
      // Course-category validation is separate from the prerequisite mapping.
      courseCategories: false,
      courseTypeFigures: true,
      prerequisites: true,
      snapshots: [],
    },
  },
  {
    slug: 'econ',
    label: 'Economics',
    match: 'econom',
    // `ast` is the major-neutral internal slot for an Associate Degree for
    // Transfer. Nearly every Economics catalog prints an arts award, while one
    // prints A.S.-T and two have conflicting A.A.-T/A.S.-T headings. The
    // aggregate control names both without rewriting the source-specific award.
    degreeSlotLabels: { ast: 'A.A.-T / A.S.-T', local_other: 'Local A.A.' },
    // The flagship Economics degree per campus, excluding business,
    // managerial, joint-math and policy variants — they carry different
    // lower-division requirements. Economics is a letters-and-science degree
    // system-wide, so the flagship is the B.A. everywhere.
    programs: {
      79: ['Economics, B.A.'],
      89: ['Economics A.B.'],
      120: ['Economics, B.A.'],
      117: ['Economics/B.A.'],
      144: ['ECONOMICS, B.A.'],
      46: ['Economics, B.A.'],
      7: ['Economics B.A.'],
      128: ['Economics, B.A.'],
      132: ['Economics B.A.'],
    },
    // Economics has a statewide A.A.-T and local A.A. cohort. The A.A.-T slot
    // contains 97 found degrees plus 18 explicit `none_found` sentinels — not
    // 115 degree records. No researched college publishes a general local
    // Economics A.S. in the pinned corpus, so an empty A.S. control would be
    // misleading.
    degreeAnalysisSlots: ['ast', 'local_other'],
    degreeTemplateEvidence: {
      total: 9,
      explicitlyVerified: 9,
      catalogYears: '2025-26 (7 templates); 2026-27 (UC Davis and UC San Diego)',
      staleResearchStatus: 9,
    },
    // Confirmed against the nine ported templates on 2026-07-23. Principles are
    // NOT split into micro and macro: seven campuses name them, but Berkeley
    // states ECON 1/2 as "Introduction to Economics" and Irvine states
    // ECON 20A/20B as "Basic Economics I/II", so a split would print a "not
    // required" bar at two campuses that plainly require both halves.
    categories: [
      { key: 'econ_principles', axis: 'economics' },
      { key: 'econ_theory', axis: 'economics' },
      { key: 'calculus', axis: 'math' },
      { key: 'statistics', axis: 'math' },
      { key: 'computing', axis: 'math' },
      { key: 'other_social', axis: 'other_social' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['economics', 'math', 'other_social', 'non_stem'],
    // Same four-column shape as Computer Science and Biology: own discipline,
    // quantitative, the supporting discipline, everything else. Economics fills
    // the supporting slot with other social sciences rather than lab science.
    courseTypes: {
      module: 'econ',
      // Match the Massachusetts Figure 2 population by excluding GE/padding
      // groups from the typed tallies for the faithful state comparison.
      excludeGeGroups: true,
      axes: {
        faithful: [
          { key: 'economics', label: 'Economics', categories: ['econ_principles', 'econ_theory'] },
          { key: 'math', label: 'Math', categories: ['calculus', 'statistics', 'computing'] },
          { key: 'other_social', label: 'Other Social Science', categories: ['other_social'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
        extended: [
          { key: 'economics', label: 'Economics', categories: ['econ_principles', 'econ_theory'] },
          { key: 'calculus', label: 'Calculus', categories: ['calculus'] },
          { key: 'statistics', label: 'Statistics', categories: ['statistics'] },
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'other_social', label: 'Other Social Science', categories: ['other_social'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
      barrierPanels: [
        { key: 'econ_principles', label: 'Economics Principles' },
        { key: 'econ_theory', label: 'Intermediate Theory' },
        { key: 'calculus', label: 'Calculus' },
        { key: 'statistics', label: 'Statistics' },
        { key: 'computing', label: 'Computing' },
        { key: 'other_social', label: 'Other Social Science' },
      ],
    },
    conceptDisciplines: ['math', 'stats', 'other'],
    prerequisiteConcepts: [
      'calc_1', 'calc_2', 'calc_3', 'linear_alg', 'diff_eq', 'linear_alg_diff_eq',
      'bus_calc_1', 'bus_calc_2', 'applied_math_3',
      'stats_calc', 'intro_stats', 'intro_data_science',
      'econ_micro', 'econ_macro', 'econ_intro_combined',
      'intro_psychology', 'intro_american_government', 'intro_sociology',
      'bio_organismal',
      'cs_1', 'cs_2_oop', 'cs_3_data_structures', 'engr_programming',
      'engl_comp_1', 'engl_comp_2', 'intro_lit',
    ],
    capabilities: {
      assistAgreements: true,
      // Strict-engine coverage verdicts exist for this major's corpus —
      // the state-agnostic requirement of the coverage matrix/histogram
      // figures (Maryland majors satisfy it through artsys_* data).
      articulationVerdicts: true,
      caCreditLossArtifact: true,
      agreementPathways: false,
      // The 2025-2026 statewide associate-degree corpus and all nine
      // four-year templates are present. Source-review warnings remain visible
      // in the analysis payload until the extracted rows are hand-verified.
      asDegrees: true,
      paperBaselines: false,
      // Deliberately permanent: new majors are ASSIST-driven end to end, so
      // there are no hand-curated website minimums to gather.
      transferMinimums: false,
      degreeTemplates: true,
      // The California unit-budget model (70-unit cap, GE netting) applies.
      unitCoverage: true,
      // Course-category validation is separate from the prerequisite mapping.
      courseCategories: false,
      courseTypeFigures: true,
      prerequisites: true,
      snapshots: [],
    },
  },
  {
    // Massachusetts, imported from the "Lost in Transfer" paper's recovered
    // workbooks (see server/data/ma/PROVENANCE.md). A state-scoped major: the
    // Massachusetts tab addresses it directly and the default picker payload
    // never offers it, so it cannot leak into a California analysis. Reserved
    // ids: universities 9001–9011, community colleges 9101–9115.
    slug: 'ma-cs',
    label: 'Computer Science (MA)',
    state: 'ma',
    match: 'computer science',
    programs: Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => [9001 + index, ['Computer Science, B.S.']]),
    ),
    // The paper's Q2 cohort is each college's AS in CS; the importer stores
    // them in the local_as slot.
    degreeAnalysisSlots: ['local_as'],
    categories: [
      { key: 'intro_programming', axis: 'computing' },
      { key: 'data_structures', axis: 'computing' },
      { key: 'other_computing', axis: 'computing' },
      { key: 'calculus', axis: 'math' },
      { key: 'other_math', axis: 'math' },
      { key: 'science', axis: 'science' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['computing', 'math', 'science', 'non_stem'],
    // Massachusetts course codes type through the CS module's rules
    // (COMP/CSCI/CSC/CIS/CAIS/CICS to computing, MATH/MAT/MTH/MA to math,
    // and so on — the MA prefixes are in the module's sets).
    courseTypes: {
      module: 'cs',
      // The paper's Figure 2 matrix carries no GE columns, so the GE-titled
      // template group stays out of this corpus's course-type tallies —
      // matching the named-requirement population and the California ports.
      excludeGeGroups: true,
      axes: {
        faithful: [
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'math', label: 'Math', categories: ['math'] },
          { key: 'science', label: 'Science', categories: ['science'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
    },
    conceptDisciplines: [],
    prerequisiteConcepts: [],
    capabilities: {
      assistAgreements: true,
      articulationVerdicts: false,
      caCreditLossArtifact: false,
      agreementPathways: false,
      asDegrees: true,
      paperBaselines: true,
      transferMinimums: false,
      degreeTemplates: true,
      // The California unit-budget model does not describe this corpus (no
      // transfer cap, no GE netting; it computes negative coverage). The
      // heatmap's unit lenses are gated off; the paper's course lens is the
      // native measure.
      unitCoverage: false,
      courseCategories: false,
      courseTypeFigures: true,
      prerequisites: false,
      snapshots: [],
    },
  },
  {
    // Virginia. Unlike Massachusetts, this corpus is ours: we gathered the
    // degree requirements and the course equivalencies, and Roy Martinez
    // verifies the associate degrees, so the California verified/unverified
    // cohort applies here and the paper-source controls do not.
    //
    // Agreements are DERIVED rather than published — Transfer Virginia issues
    // course equivalencies and degree requirements separately and never joins
    // them. `scripts/va/buildVaAgreements.js` performs the join; re-run it
    // whenever va_courses or va_requirements change.
    //
    // Stable ids come from services/virginia/institutionIds.js. They are an
    // explicit registry and never change when a display name or cohort changes.
    slug: 'va-cs',
    label: 'Computer Science (VA)',
    state: 'va',
    match: 'computer science',
    programs: {
      9205: ['Computer Science, B.S.'], // Bridgewater College
      9206: ['Computer Science, B.S.'], // Christopher Newport University
      9210: ['Computer Science, B.S.'], // George Mason University
      9213: ['Computer Science, B.S.'], // James Madison University
      9214: ['Computer Science, B.S.'], // Longwood University
      9217: ['Computer Science, B.S.'], // Norfolk State University
      9218: ['Computer Science, B.S.'], // Old Dominion University
      9219: ['Computer Science, B.S.'], // Radford University
      9221: ['Computer Science, B.S.'], // Randolph-Macon College
      9224: ['Computer Science, B.S.'], // Shenandoah University
      9226: ['Computer Science, B.S.'], // The University of Virginia's College at Wise
      9228: ['Computer Science, B.S.'], // University of Mary Washington
      9229: ['Computer Science, B.S.'], // Virginia Commonwealth University
      9230: ['Computer Science, B.S.'], // Virginia Polytechnic Institute and State University
      9231: ['Computer Science, B.S.'], // Virginia State University
      9233: ['Computer Science, B.S.'], // William & Mary
      // The University of Virginia and Virginia Military Institute publish CS
      // degree requirements but no course equivalencies at all, so they carry
      // no agreements and are absent here rather than reading as zero.
    },
    // The sending cohort: the colleges that publish a computer-science
    // associate degree, and so can put a student on this pathway at all. The
    // other eight VCCS colleges have no CS associate, so a cell for them is not
    // a zero — it is a pathway that does not exist. Leaving them in rendered
    // eight rows of 0% and pulled the pooled mean from 46.3% to 30.7%.
    sendingCollegeIds: [
      9301, // Blue Ridge Community College
      9302, // Brightpoint Community College
      9303, // Central Virginia Community College
      9306, // Germanna Community College
      9307, // J Sargeant Reynolds Community College
      9308, // Laurel Ridge Community College
      9311, // New River Community College
      9312, // Northern Virginia Community College
      9314, // Paul D. Camp Community College
      9315, // Piedmont Virginia Community College
      9319, // Southwest Virginia Community College
      9320, // Tidewater Community College
      9321, // Virginia Highlands Community College
      9322, // Virginia Peninsula Community College
      9323, // Virginia Western Community College
      9324, // Wytheville Community College
    ],
    // Virginia's community-college cohort is the VCCS transfer-oriented
    // associate degree, stored in the local_as slot by the collection pipeline.
    degreeAnalysisSlots: ['local_as'],
    categories: [
      { key: 'intro_programming', axis: 'computing' },
      { key: 'data_structures', axis: 'computing' },
      { key: 'other_computing', axis: 'computing' },
      { key: 'calculus', axis: 'math' },
      { key: 'other_math', axis: 'math' },
      { key: 'science', axis: 'science' },
      { key: 'non_stem', axis: 'non_stem' },
    ],
    broadAxes: ['computing', 'math', 'science', 'non_stem'],
    courseTypes: {
      module: 'cs',
      // Virginia marks its breadth work structurally (ge_area receivers on
      // breadth-tier sections) rather than by block title, and the shared
      // reader already excludes those from the named-requirement population,
      // so no corpus-specific exclusion is needed here.
      axes: {
        faithful: [
          { key: 'computing', label: 'Computing', categories: ['computing'] },
          { key: 'math', label: 'Math', categories: ['math'] },
          { key: 'science', label: 'Science', categories: ['science'] },
          { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
        ],
      },
    },
    conceptDisciplines: [],
    prerequisiteConcepts: [],
    // NO PUBLICATION GATE while Virginia's figures are in development.
    //
    // The gate withholds every VA figure until the projection issues an exact
    // runtime receipt. That is the right behaviour for released figures and the
    // wrong behaviour for ones still being built: nothing here is approved for
    // release yet, so there is nothing for a receipt to protect, and the gate
    // only prevented the figures from being looked at during development.
    //
    // Restore it by putting back:
    //   publicationGate: { contract: 'va-analysis-publication-receipt-v1' },
    // which is the single switch that re-arms the check in
    // frontend/src/visuals/analysisAvailability.js. Do that when a Virginia
    // figure is ready to be published rather than merely readable.
    capabilities: {
      assistAgreements: true,
      articulationVerdicts: false,
      caCreditLossArtifact: false,
      agreementPathways: false,
      asDegrees: true,
      // Both degree sides must carry one explicit canonical analysis contract.
      // Shared consumers select exact semantics from this capability and the
      // document contract, rather than from the state name.
      canonicalSourceRequirements: true,
      // No external paper publishes per-cell values for this corpus, so there
      // is nothing to compare against and no source selector. This flag is
      // what separates a paper import (Massachusetts) from data we gathered
      // ourselves: it keeps the verified-cohort control on for Virginia.
      paperBaselines: false,
      transferMinimums: false,
      degreeTemplates: true,
      // Virginia publishes no transfer-unit cap analogous to California's 70
      // units, and we have not modelled one, so the unit lenses stay off until
      // that policy is researched. The course lens is the native measure.
      unitCoverage: false,
      courseCategories: false,
      courseTypeFigures: true,
      prerequisites: true,
      // The VA graph tab reads exact VCCS course formulas, but Figure 6 also
      // needs a university-local prerequisite corpus and a formula-aware
      // pathway assembler. Do not equate graph availability with a valid
      // curricular-complexity measure.
      pathwayComplexityPrerequisites: false,
      snapshots: [],
    },
  },
];

const bySlug = new Map(MAJORS.map((m) => [m.slug, m]));

function getMajor(slug) {
  return bySlug.get(String(slug ?? '')) || null;
}

/**
 * Majors for iteration. The default excludes state-scoped majors — every
 * historical caller is a California-console feature (audit rollups, visible
 * pairs, admin inventories) that must not grow rows when a new state lands.
 * Validation and reverse-lookup sites that need every ADDRESSABLE slug pass
 * `{ includeStates: true }`.
 */
function listMajors({ includeStates = false } = {}) {
  return includeStates ? [...MAJORS] : MAJORS.filter((major) => !major.state);
}

function defaultMajor() {
  return MAJORS[0];
}

function programsFor(majorOrPrograms) {
  if (typeof majorOrPrograms === 'string') return getMajor(majorOrPrograms)?.programs || null;
  if (majorOrPrograms?.programs) return majorOrPrograms.programs;
  return majorOrPrograms && typeof majorOrPrograms === 'object' ? majorOrPrograms : null;
}

/** Flatten a configured major into exact, JSON-safe campus/program pairs. */
function programPairs(majorOrPrograms) {
  const programs = programsFor(majorOrPrograms);
  if (!programs) return [];
  return Object.entries(programs).flatMap(([schoolId, names]) =>
    (Array.isArray(names) ? names : []).map((major) => ({
      school_id: Number(schoolId),
      major: String(major),
    }))).filter((pair) => Number.isFinite(pair.school_id));
}

/** Exact Mongo clause for a configured major's campus/program pairs. */
function programPairClause(majorOrPrograms, {
  schoolField = 'uc_school_id', majorField = 'major',
} = {}) {
  const pairs = programPairs(majorOrPrograms);
  // Configured majors always have pairs. Keeping an explicit match-nothing
  // result makes an incomplete future entry fail closed instead of exposing
  // the full corpus.
  if (!pairs.length) return { _id: { $exists: false } };
  const namesBySchool = new Map();
  for (const pair of pairs) {
    if (!namesBySchool.has(pair.school_id)) namesBySchool.set(pair.school_id, []);
    namesBySchool.get(pair.school_id).push(pair.major);
  }
  return {
    $or: [...namesBySchool.entries()].map(([schoolId, majors]) => ({
      [schoolField]: schoolId,
      [majorField]: { $in: majors },
    })),
  };
}

/** The majors payload for GET /api/majors. Every field here is JSON-safe. */
/**
 * Majors for a picker payload. The default payload is the California
 * console's picker and excludes state-scoped majors; a state argument
 * returns that state's majors alone (the Massachusetts tab asks for
 * `{ state: 'ma' }`).
 */
function serializeMajors({ state } = {}) {
  // 'all' is the cross-corpus registry, used only by the compare-tab pane
  // picker. Every other caller keeps its scoped payload, so the California
  // picker can never list a state major.
  if (state === 'all') return [...MAJORS];
  if (state) return MAJORS.filter((major) => major.state === state);
  return MAJORS.filter((major) => !major.state);
}

/**
 * Resolve ?major=<slug> (preferred) or the legacy ?majorContains=<text> into
 * the scope the analysis layer already speaks. The slug wins when both are
 * given. An unknown slug returns {error, known} for the endpoint to 400 on.
 */
function majorScopeFromQuery(query = {}) {
  const slug = String(query.major ?? '').trim();
  if (slug) {
    const entry = getMajor(slug);
    if (!entry) return { error: `unknown major: ${slug}`, known: MAJORS.map((m) => m.slug) };
    return { slug: entry.slug, majorPrograms: entry.programs, majorContains: '' };
  }
  return {
    slug: null,
    majorPrograms: null,
    majorContains: String(query.majorContains ?? '').trim(),
  };
}

module.exports = {
  getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery,
  programPairs, programPairClause,
};
