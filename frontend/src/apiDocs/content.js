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
  'One local helper: get() reads shared data and publish() renders your matplotlib figure locally before sharing the finished files.'

export const STARTER_STEPS = [
  ['Create a token', 'Generate a personal token in the Tokens tab. Keep it out of shared notebooks.'],
  ['Get starter.py', 'Download the file below and keep it beside your notebook or analysis script.'],
  ['Set the token', 'Set PMT_TOKEN in your shell, or place the token in TOKEN at the top of your local starter.py.'],
  ['Read data', 'Call pmt.get("exports/receivers") or another path from the Endpoints tab. It returns a pandas DataFrame when the response contains rows.'],
  ['Publish a figure', 'Pass the completed matplotlib Figure to pmt.publish(fig, slug=..., title=...). Your machine creates SVG, PNG, and PDF; only those files are uploaded.'],
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
        plain: 'Kinds are transfer_minimum, degree, ge_pattern, igetc, and associate_degree.',
        returns: '{ rows: [requirement documents] }',
      },
      {
        method: 'GET',
        path: '/curated/prerequisites',
        title: 'Course prerequisites',
        plain: 'Resolved course-id edges plus rows marked needs_review when source text could not be mapped safely.',
        returns: '{ rows: [ { course_id, prerequisite_ids, unresolved_prerequisites, status, ... } ] }',
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
    'Build the matplotlib Figure locally, then call pmt.publish(fig, ...). The local client renders SVG, PNG, and PDF and uploads only those finished files. No Python code runs on the server.',
    '```python\n' + EXAMPLE_FIGURE_SCRIPT + '\n```',
    '## Data model',
    ...GUIDE_SECTIONS.flatMap((section) => [
      `### ${section.title}`,
      ...section.blocks.map(mdBlock),
    ]),
  ].join('\n\n')
}
