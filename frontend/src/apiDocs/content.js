/** Shared content for the rendered API guide and the "Copy for AI" briefing. */

export const AUTH_HEADER = 'Authorization: Bearer <your pmtr_... token>'

export const pythonSnippet = (base) => `import requests, pandas as pd

API = "${base}"
H = {"Authorization": "Bearer pmtr_..."}

rows = requests.get(f"{API}/exports/receivers", headers=H).json()["rows"]
df = pd.DataFrame(rows)`

export const GETTING_STARTED_NOTES = [
  'The permanent base path is /api; there is no version segment.',
  'List responses expose rows, while bulk exports also include n and params.',
  'Bulk exports accept ?format=csv. Nested values are JSON-encoded in CSV cells.',
  'The course exports are full catalogs for all 115 community colleges and all 9 UC campuses in the source scope.',
]

export const STARTER_EXPLANATION =
  'One local helper: get() reads shared data, while publish() shares anything from a basic Matplotlib figure to a supported interactive visual rendered exactly like the website built-ins.'

export const STARTER_STEPS = [
  ['Create a token', 'Generate a personal token in the Tokens tab. Keep it out of shared notebooks.'],
  ['Get starter.py', 'Download the file below and keep it beside your notebook or analysis script.'],
  ['Set the token', 'Set PMT_TOKEN in your shell, or place the token in TOKEN at the top of your local starter.py.'],
  ['Choose an example', 'Use Single figure for the usual workflow. Use Multiple states only when one visual needs a finite selector or toggle. Both import the same starter.py.'],
  ['Read data', 'Call pmt.get("exports/receivers") or another path from the Endpoints tab. It returns a pandas DataFrame when the response contains rows.'],
  ['Publish a figure', 'Pass one completed Figure to pmt.publish(fig, ...). Your machine creates every SVG, PNG, and PDF; only those finished files are uploaded.'],
  ['Add functionality when useful', 'Pass named variants for finite controls, or use visual="paper-credit-loss" to mount a supported interactive renderer with the same controls and export behavior as the built-in.'],
]

export const ENDPOINT_GROUPS = [
  {
    id: 'orientation',
    title: 'Orientation',
    endpoints: [
      {
        method: 'GET',
        path: '/data/summary',
        title: 'Dataset summary',
        plain: 'Current refresh time, visible campus programs, and scoped document counts.',
        returns: '{ last_data_refresh_at, scoped, schools, counts }',
      },
      {
        method: 'GET',
        path: '/assist/institutions?kind=community_college',
        title: 'Institutions',
        plain: 'Community colleges or universities. Omit kind for both.',
        returns: '{ rows: [ { institution_id, source_id, kind, system, name, ... } ] }',
        fields: [
          ['institution_id', 'Stable namespaced id such as cc:113 or uc:79.'],
          ['district, region, counties_served', 'Curated geography on community-college rows.'],
          ['academic_calendar, tuition_per_credit_usd', 'Curated university facts when available.'],
        ],
      },
    ],
  },
  {
    id: 'assist',
    title: 'ASSIST data',
    blurb: 'Source-derived institutions, complete course catalogs, agreements, and admissions.',
    endpoints: [
      {
        method: 'GET',
        path: '/assist/courses?institution_id=cc:113',
        title: 'One institution catalog',
        plain: 'Every course for one community college or UC campus. Use institution_id=uc:<id> for receiving courses.',
        returns: '{ rows: [course documents] }',
        fields: [
          ['_id', 'Canonical id: cc:<course_id> or university:<parent_id>.'],
          ['side', 'sending for CC courses; receiving for university courses.'],
          ['institution_id', 'The namespaced institution id.'],
        ],
      },
      {
        method: 'GET',
        path: '/assist/courses?ids=cc:123,university:456',
        title: 'Courses by id',
        plain: 'Fetch up to 500 mixed sending/receiving course ids in one request.',
        returns: '{ rows: [course documents] }',
      },
      {
        method: 'GET',
        path: '/assist/agreements?college_id=cc:113&university_id=uc:79',
        title: 'Agreements for a school pair',
        plain: 'Nested ASSIST agreement documents. Add major=<exact name> to select one program.',
        returns: '{ rows: [agreement documents] }',
      },
      {
        method: 'GET',
        path: '/admissions?institution_id=uc:79&major=Computer%20Science',
        title: 'Transfer admissions',
        plain: 'Available transfer admit-rate and GPA records, optionally narrowed to a campus and exact major.',
        returns: '{ rows: [admission documents] }',
      },
    ],
  },
  {
    id: 'curated',
    title: 'Hand-curated data',
    blurb: 'Human-gathered requirements and mappings kept separate from ASSIST-derived records.',
    endpoints: [
      {
        method: 'GET',
        path: '/curated/requirements?kind=transfer_minimum',
        title: 'Requirements by kind',
        plain: 'Kinds include transfer_minimum, degree, ge_pattern, igetc, as_degree_template, and as_degree.',
        returns: '{ rows: [requirement documents] }',
      },
      {
        method: 'GET',
        path: '/curated/as-degree-availability',
        title: 'Associate-degree availability by college',
        plain: 'One row per surveyed community college, separating CS A.S.-T availability, confirmed absence, extraction gaps, local CS A.S. programs, and other computing degrees.',
        returns: '{ counts, rows: [ { college_id, college_name, types: { ast, local_cs_as, local_computing } } ] }',
        fields: [
          ['types.<type>.status', 'available, confirmed_none, data_gap, or duplicate_candidate.'],
          ['types.ast', 'The standardized Computer Science Associate Degree for Transfer cohort used for analysis.'],
          ['inventory_offered, inventory_titles', 'Catalog-inventory evidence kept separate from whether a full requirement record was extracted.'],
        ],
      },
      {
        method: 'GET',
        path: '/curated/as-degrees?degree_type=ast',
        title: 'Associate-degree QA records',
        plain: 'Summarized associate-degree records, optionally filtered to ast, local_cs_as, or local_computing; use ast for the standardized transfer-analysis cohort.',
        returns: '{ params: { degree_type }, template, n, rows }',
      },
      {
        method: 'GET',
        path: '/curated/prerequisites',
        title: 'Course prerequisites (legacy)',
        plain: 'The prior group\'s hand-gathered prerequisite edges for 16 colleges. Kept for reference; the prerequisite-graph endpoint below is the current statewide source.',
        returns: '{ rows: [ { course_id, prerequisite_ids, unresolved_prerequisites, status, ... } ] }',
      },
      {
        method: 'GET',
        path: '/curated/prerequisite-graph?college_id=cc:113',
        title: 'Prerequisite concept graph',
        plain: 'The concept vocabulary and its prerequisite rules. Add college_id=cc:<id> for that college\'s courses, projected course-to-course prerequisite edges, and coverage stats; omit it for the canonical concept model. This is the full 115-college prerequisite source.',
        returns: '{ concepts, rules, stats, courses?, edges?, legacy? }',
        fields: [
          ['concepts', 'Each: slug, name, discipline, requires (a slug or an OR-group array = any one of), satisfies (combined-course equivalences), note.'],
          ['edges (with college_id)', 'Projected prerequisites { from: cc:<id>, to: cc:<id> }, assuming the student takes the cheapest prerequisite chain.'],
          ['stats', 'in_scope, examined, mapped, edges, and legacy-agreement overlap where the prior group had data.'],
        ],
      },
      {
        method: 'GET',
        path: '/curated/course-categories',
        title: 'University course categories',
        plain: 'Human category labels attached to university course parent ids.',
        returns: '{ categories, canonical, broad }',
      },
      {
        method: 'GET',
        path: '/curated/receiver-overrides',
        title: 'Receiver judgments',
        plain: 'Human exclusions or category overrides keyed by agreement receiver hash.',
        returns: '{ overrides }',
      },
      {
        method: 'GET',
        path: '/curated/degrees',
        title: 'Readable degree requirements',
        plain: 'Full four-year degree templates enriched with university course labels and slot totals.',
        returns: '{ rows, generated_at }',
      },
      {
        method: 'GET',
        path: '/curated/degree-evaluation?school_id=79&community_college_id=113',
        title: 'Evaluate one degree at one college',
        plain: 'The degree ledger, transferable coverage, and tier totals for a campus/college pair.',
        returns: '{ school_id, community_college_id, completion, groups, ... }',
      },
    ],
  },
  {
    id: 'exports',
    title: 'Bulk exports',
    blurb: 'The whole research corpus in one call. Add ?format=csv when useful.',
    endpoints: [
      {
        method: 'GET',
        path: '/exports/receivers',
        title: 'Every receiving requirement',
        plain: 'One flattened row per agreement receiver, including group/section logic and CC course options.',
        returns: '{ params, n, rows }',
        fields: [
          ['agreement_id, school_id, community_college_id, major', 'Agreement identity.'],
          ['is_required, group_advisement, section_advisement', 'Requirement logic.'],
          ['parent_ids, articulation_status, options', 'Receiving course ids and sending-course solutions.'],
        ],
      },
      {
        method: 'GET',
        path: '/exports/agreements',
        title: 'Every agreement',
        plain: 'Full nested agreement trees, visibility-scoped for the caller.',
        returns: '{ params, n, rows }',
      },
      {
        method: 'GET',
        path: '/exports/courses',
        title: 'All community-college courses',
        plain: 'The full 115-college sending catalog, not only courses referenced by selected agreements.',
        returns: '{ params, n, rows }',
      },
      {
        method: 'GET',
        path: '/exports/university-courses',
        title: 'All UC courses',
        plain: 'The full receiving catalog for all 9 UC campuses in the source database.',
        returns: '{ params, n, rows }',
      },
      {
        method: 'GET',
        path: '/exports/cs-ast-degrees',
        title: 'All Computer Science A.S.-T degrees',
        plain: 'The isolated statewide CS A.S.-T analysis cohort, with full nested degree requirements and referenced community-college course records; local and other computing degrees are excluded.',
        returns: '{ params: { degree_type: "ast", ... }, n, rows }',
      },
      {
        method: 'GET',
        path: '/exports/local-cs-as-degrees',
        title: 'All local Computer Science A.S. degrees',
        plain: 'The college-defined local CS A.S. analysis cohort, with full nested requirements and referenced course records; A.S.-T and broader computing degrees are excluded.',
        returns: '{ params: { degree_type: "local_cs_as", ... }, n, rows }',
      },
    ],
  },
  {
    id: 'spot',
    title: 'Spot checks',
    endpoints: [
      {
        method: 'GET',
        path: '/audit/doc/:agreementId',
        title: 'One readable agreement',
        plain: 'An agreement plus CC/UC course-name maps and its ASSIST link.',
        returns: '{ doc, course_names, university_courses, assist_url, system }',
      },
      {
        method: 'GET',
        path: '/data/raw-assist/:agreementId',
        title: 'Upstream ASSIST payload',
        plain: 'A live fetch of the raw ASSIST response for parser-fidelity checks.',
        returns: 'raw ASSIST JSON',
      },
    ],
  },
]

export const PARTNER_ENDPOINT_GROUPS = ENDPOINT_GROUPS

export const GUIDE_SECTIONS = [
  {
    id: 'dataset',
    title: 'The dataset',
    blocks: [
      {
        type: 'p',
        text: 'The database contains complete CC and UC course catalogs for every included school. Agreement selection is narrower: one document per ported college, UC campus, and major.',
      },
      {
        type: 'p',
        text: 'ASSIST-derived records use the assist_* collections and /assist routes. Human-gathered records use curated_* collections and /curated routes. Refresh time and source URLs provide provenance; there is no dataset-version field.',
      },
    ],
  },
  {
    id: 'shape',
    title: 'Agreement shape',
    blocks: [
      {
        type: 'code',
        text: `agreement\n\u2514\u2500 requirement_groups[]\n   \u2514\u2500 sections[]\n      \u2514\u2500 receivers[]\n         \u2514\u2500 options[]`,
      },
      {
        type: 'p',
        text: 'A receiver is one UC-side requirement. Its options are the CC course combinations that satisfy it. The receivers export flattens these leaves while retaining group and section logic.',
      },
    ],
  },
  {
    id: 'logic',
    title: 'Requirement logic',
    blocks: [
      {
        type: 'table',
        head: ['field', 'meaning'],
        rows: [
          ['is_required = false', 'Recommended group; exclude from strict minimum calculations.'],
          ['group_conjunction = Or', 'One section/group branch can satisfy the requirement.'],
          ['group_advisement = N', 'Choose N receivers across the group.'],
          ['section_advisement = N', 'Choose N receivers in the section.'],
          ['options_conjunction', 'How alternative options combine.'],
          ['course_conjunction', 'Whether course ids inside one option are AND or OR.'],
        ],
      },
    ],
  },
  {
    id: 'prereq-concepts',
    title: 'Prerequisite concept graph',
    blocks: [
      {
        type: 'p',
        text: 'Prerequisites are modeled as a small set of canonical course concepts (calc_1, cs_2_oop, gen_chem_1, ...) with prerequisite rules between them. Each community-college course carries a concept tag; per-college prerequisite edges are projected at read time from the rules applied to whatever courses a college actually offers.',
      },
      {
        type: 'p',
        text: 'A requires entry is a concept slug, or an array of slugs meaning "any one of these" (an OR-group). A satisfies list marks combined courses (one Linear Algebra + Differential Equations course counts as both). CS courses may carry a language so an intro links only to same-language advanced courses. The projection assumes the student takes the cheapest prerequisite chain.',
      },
      {
        type: 'table',
        head: ['from', 'to'],
        rows: [
          ['assist_courses.concept', 'curated_requirements.slug (kind prereq_concept)'],
          ['prerequisite-graph edges[].from / to', 'assist_courses._id (cc:<course_id>)'],
        ],
      },
      {
        type: 'p',
        text: 'This is a defensible statewide approximation, not hand-verified per college, and is built to be corrected in place: fixing a mapping re-flows into every derived figure with no pipeline re-run. It powers /analysis/complexity.',
      },
    ],
  },
  {
    id: 'joins',
    title: 'Stable joins',
    blocks: [
      {
        type: 'table',
        head: ['from', 'to'],
        rows: [
          ['agreement.college_id', 'assist_institutions.institution_id (cc:<id>)'],
          ['agreement.university_id', 'assist_institutions.institution_id (uc:<id>)'],
          ['options[].course_keys[]', 'assist_courses._id (cc:<course_id>)'],
          ['receiving.course_id / course_ids[]', 'assist_courses._id (university:<parent_id>)'],
          ['receiver.hash_id', 'curated receiver override receiver_hash'],
          ['agreement _id', 'agreement_reviews.doc_id'],
        ],
      },
      {
        type: 'p',
        text: 'Legacy numeric course_id and parent_id fields remain on canonical course rows during the transition, but new code should prefer namespaced ids.',
      },
    ],
  },
]

export const curlBootstrap = (base) =>
  `curl -H "Authorization: Bearer pmtr_..." ${base}/client.py -o starter.py`

export const EXAMPLE_FIGURE_SCRIPT = `import matplotlib.pyplot as plt
import starter as pmt

df = pmt.get("exports/receivers")
counts = df.groupby("school").size().sort_values(ascending=False)

fig, ax = plt.subplots(figsize=(8, 5))
counts.plot.bar(ax=ax)
ax.set_ylabel("requirements")
fig.tight_layout()

pmt.publish(fig,
            slug="requirements-by-campus",
            title="Requirements per UC campus")`

export const EXAMPLE_PUBLISH_COMMAND =
  'pmt.publish(fig, slug="requirements-by-campus", title="Requirements per UC campus")'

export const EXAMPLE_INTERACTIVE_PUBLISH = `pmt.publish(
    visual="paper-credit-loss",
    slug="paper-credit-loss-copy",
    title="Paper-style credit loss (published copy)",
)`

export const EXAMPLE_VARIANT_SCRIPT = `import matplotlib.pyplot as plt
import starter as pmt


def make_figure(values, title, color):
    """Build one complete state of the published visual."""
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(["A", "B", "C"], values, color=color)
    ax.set_title(title)
    ax.set_ylabel("Students")
    fig.tight_layout()
    return fig


baseline = make_figure([3, 5, 4], "Baseline", "#536b8e")
updated = make_figure([4, 7, 6], "Updated data", "#16856b")

try:
    pmt.publish(
        slug="two-state-example",
        title="Basic multiple-state example",
        variants=[
            {
                "key": "baseline",
                "label": "Baseline",
                "state": {"version": "baseline"},
                "figure": baseline,
            },
            {
                "key": "updated",
                "label": "Updated data",
                "state": {"version": "updated"},
                "figure": updated,
            },
        ],
        controls=[
            {
                "key": "version",
                "label": "Version",
                "type": "select",
                "default": "baseline",
                "options": [
                    {"value": "baseline", "label": "Baseline"},
                    {"value": "updated", "label": "Updated data"},
                ],
            },
        ],
        default_variant="baseline",
    )
finally:
    plt.close(baseline)
    plt.close(updated)`

export const STARTER_TEMPLATES = [
  {
    id: 'simple',
    label: 'Single figure',
    filename: 'simple_figure.py',
    summary: 'Read data, build one Matplotlib figure, and publish it.',
    code: EXAMPLE_FIGURE_SCRIPT,
  },
  {
    id: 'variants',
    label: 'Multiple states',
    filename: 'variant_figure.py',
    summary: 'Render a finite set of figures locally and add a selector that switches among them.',
    code: EXAMPLE_VARIANT_SCRIPT,
  },
]

const publishingRules = [
  'The researcher already has starter.py. Generate or edit only their analysis script; do not recreate the client.',
  'Import it with `import starter as pmt` and use the single public `pmt.publish(...)` method.',
  'Never place a real pmtr_ token in generated code. The researcher supplies it through the PMT_TOKEN environment variable.',
  'All calculations and Matplotlib rendering happen locally. No Python code runs on the server, and no researcher-supplied JavaScript is accepted.',
  'Use one completed Figure for a normal publication. Use variants only for a finite set of states known when the script runs.',
  'For variants, every control key must exist in every variant state, and state values must exactly match the declared control option values.',
  'Use an allowlisted `visual="..."` renderer only when exact website-native behavior is requested and that renderer is documented as supported.',
]

const mdTable = (head, rows) => [
  `| ${head.join(' | ')} |`,
  `| ${head.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n')

const mdBlock = (block) => {
  if (block.type === 'p') return block.text
  if (block.type === 'code') return '```\n' + block.text + '\n```'
  if (block.type === 'table') return mdTable(block.head, block.rows)
  if (block.type === 'list') return block.items.map((item) => `- ${item}`).join('\n')
  return ''
}

const mdEndpoint = (endpoint) => {
  const parts = [`### ${endpoint.method} ${endpoint.path} - ${endpoint.title}`, endpoint.plain]
  if (endpoint.returns) parts.push(`Returns: \`${endpoint.returns}\``)
  if (endpoint.fields?.length) {
    parts.push(endpoint.fields.map(([field, description]) => `- \`${field}\` - ${description}`).join('\n'))
  }
  return parts.join('\n\n')
}

export function buildAiBriefing(base) {
  return [
    '# Transfer Pathways Research API',
    `Base URL: ${base}`,
    `Every request: \`${AUTH_HEADER}\``,
    ...GETTING_STARTED_NOTES.map((note) => `- ${note}`),
    '```python\n' + pythonSnippet(base) + '\n```',
    '## Endpoints',
    ...PARTNER_ENDPOINT_GROUPS.flatMap((group) => [
      `### ${group.title}`,
      ...group.endpoints.map(mdEndpoint),
    ]),
    '## Publishing',
    publishingRules.map((rule) => `- ${rule}`).join('\n'),
    '### Single figure',
    '```python\n' + EXAMPLE_FIGURE_SCRIPT + '\n```',
    '### Multiple states',
    '```python\n' + EXAMPLE_VARIANT_SCRIPT + '\n```',
    '### Website-native renderer',
    '```python\n' + EXAMPLE_INTERACTIVE_PUBLISH + '\n```',
    '## Data model',
    ...GUIDE_SECTIONS.flatMap((section) => [
      `### ${section.title}`,
      ...section.blocks.map(mdBlock),
    ]),
  ].join('\n\n')
}
