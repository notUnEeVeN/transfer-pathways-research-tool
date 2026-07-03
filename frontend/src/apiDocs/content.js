/**
 * API documentation content — the single source of truth for the API tab.
 *
 * The Endpoints page and the Data guide render these objects, and
 * buildAiBriefing() serializes the SAME objects to markdown for the
 * "Copy for AI" button — the page and the paste can't drift apart.
 *
 * Writing rules: short and plain. One or two sentences per endpoint — what
 * it returns and when to reach for it. Technical field lists stay behind
 * the expander (and in the AI paste).
 */

// ───────────────────────── getting started ─────────────────────────

export const AUTH_HEADER = 'Authorization: Bearer <your pmtr_… token>'

export const pythonSnippet = (base) => `import requests, pandas as pd

API = "${base}"
H = {"Authorization": "Bearer pmtr_..."}  # create a token in the Tokens tab

rows = requests.get(f"{API}/export/receivers", headers=H).json()["rows"]
df = pd.DataFrame(rows)   # one row per campus requirement`

// Rendered as one compact line on the page; listed in full in the AI paste.
export const GETTING_STARTED_NOTES = [
  'Every endpoint is a GET with the Authorization header.',
  'JSON list responses look like { dataset_version, n, rows }. Export and analysis endpoints also take ?format=csv (the version then rides in the X-Dataset-Version header).',
  'The dataset is versioned — record dataset_version beside any figure or table you produce so results stay attributable to an exact dataset state.',
  'Most list endpoints accept majorContains=<substring> (case-insensitive) to filter to one major.',
]

// ───────────────────────── endpoints ─────────────────────────

export const ENDPOINT_GROUPS = [
  {
    id: 'scope',
    title: 'Orientation',
    endpoints: [
      {
        method: 'GET',
        path: '/data/summary',
        title: 'The dataset at a glance',
        plain:
          'Majors per campus, document counts, the current dataset_version, and recent changes. Call it first.',
        returns: '{ dataset_version, schools: [...], counts: {...}, changelog: [...] }',
        fields: [
          ['schools[]', 'per campus: school_id, school, majors[], n_agreements'],
          ['counts', 'agreements, majors, community_colleges, courses, university_courses'],
          ['changelog[]', 'recent port operations: dataset_version, at, action'],
        ],
      },
      {
        method: 'GET',
        path: '/community-colleges',
        title: 'The community colleges',
        plain:
          'All community colleges as { id, name } — the lookup for the community_college_id values used everywhere else.',
        returns: '[ { id, name }, ... ]',
      },
      {
        method: 'GET',
        path: '/schools',
        title: 'The universities',
        plain:
          'The UC campuses as { id, name }, wrapped in { uc: [...] }. These are the school_id / university_id values on every other endpoint.',
        returns: '{ uc: [ { id, name }, ... ] }',
      },
    ],
  },
  {
    id: 'exports',
    title: 'Bulk exports',
    blurb: 'The whole corpus, one call each. JSON or ?format=csv.',
    endpoints: [
      {
        method: 'GET',
        path: '/export/receivers',
        title: 'Every campus requirement, one row each',
        plain:
          'The workhorse. Each requirement of each agreement as a flat row — status, satisfying course options, and the requirement logic included. Most statistics are a pandas groupby over this table.',
        returns: '{ dataset_version, n, rows: [...] } — one row per receiver',
        fields: [
          ['agreement_id / school_id / school / community_college_id / community_college / major', 'where the requirement lives'],
          ['group_index, is_required, group_conjunction, group_advisement, group_unit_advisement', 'requirement-group logic (see the guide)'],
          ['section_index, section_advisement, section_unit_advisement, receiver_index', 'section logic'],
          ['hash_id', 'stable id of the campus-side requirement — joins the curation overlays'],
          ['kind, receiving_name, parent_ids[], ge_code', 'what the campus asks for: course, series, requirement, or ge_area'],
          ['articulation_status, not_articulated_reason', 'whether the college can satisfy it, and if not, why'],
          ['options[], options_conjunction, n_options', 'the CC course combinations that satisfy it'],
        ],
        example:
          '# gap rate by campus:\ndf[df.is_required & (df.articulation_status == "not_articulated")\n   & (df.not_articulated_reason != "must_take_at_university")]\\\n  .groupby("school").size()',
      },
      {
        method: 'GET',
        path: '/export/agreements',
        title: 'Full agreements, as stored',
        plain:
          'The nested requirement trees, exactly as the database holds them. Use when you need the tree itself — /export/receivers is the already-flattened version.',
        returns: '{ dataset_version, n, rows: [agreement docs] }',
      },
      {
        method: 'GET',
        path: '/export/courses',
        title: 'The community-college catalog',
        plain:
          'Receiver options point into it via course_id; units feed credit-loss math. Includes cross-listing and GE-area tags.',
        returns: '{ dataset_version, n, rows: [...] }',
        fields: [
          ['course_id', 'numeric id — joins options[].course_ids'],
          ['prefix, number, title, units, community_college_id', 'the catalog row'],
          ['same_as[]', 'cross-listed equivalent course ids'],
          ['igetc_area[], csu_ge_area[], calgetc_area[], uc_transferable', 'GE / transferability tags'],
        ],
      },
      {
        method: 'GET',
        path: '/export/university-courses',
        title: 'The university-side catalog',
        plain:
          'The campus courses agreements articulate to. Receivers point into it via parent_id; units are a min–max range.',
        returns: '{ dataset_version, n, rows: [...] }',
        fields: [
          ['parent_id', 'globally unique numeric id — joins receiving.parent_id(s)'],
          ['prefix, number, title, department, university_id', 'the catalog row'],
          ['min_units, max_units', 'unit range'],
        ],
      },
    ],
  },
  {
    id: 'analysis',
    title: 'Precomputed analyses',
    blurb: "The papers' measures, ready to plot. All accept majorContains= and ?format=csv.",
    endpoints: [
      {
        method: 'GET',
        path: '/analysis/coverage',
        title: 'How complete each agreement is',
        plain:
          'One row per agreement by default: required receivers, how many are articulated, and the percentage. Add groupBy=district|county for rollups or requirements=paper to evaluate the imported hard-requirement subset.',
        returns: '{ dataset_version, params, n, rows: [...] }',
        fields: [
          ['receivers_required, receivers_articulated', 'required-receiver counts (recommended groups excluded)'],
          ['pct_articulated', '0–100, null when there are no required receivers'],
          ['fully_articulated', 'true when every required receiver is articulated'],
        ],
      },
      {
        method: 'GET',
        path: '/analysis/credit-loss',
        title: 'The cheapest path, and what it costs',
        plain:
          'Solves each agreement\'s option trees for the minimal CC course set: courses, units, many-to-one requirements, blocked receivers — with quarter → semester normalization.',
        returns: '{ dataset_version, params, n, rows: [...] }',
        fields: [
          ['min_cc_courses, min_cc_units, courses[]', 'the solved minimal course set'],
          ['receivers_required, receivers_satisfiable, receivers_blocked', 'how much of the agreement is satisfiable'],
          ['many_to_one', 'receivers whose cheapest path needs >1 CC course'],
          ['campus_calendar, semester_equiv_required', 'quarter/semester normalization'],
          ['district', "the college's district, for district rollups"],
        ],
      },
      {
        method: 'GET',
        path: '/analysis/choice-cost?schoolIds=7,117',
        title: 'The cost of keeping campus options open',
        plain:
          'Takes an ORDERED schoolIds list; per college, reports how many extra CC courses each successive campus adds. Order matters — permute for averages.',
        returns: '{ dataset_version, params, n, rows: [...] }',
        fields: [
          ['total_courses', 'union course count across the whole list'],
          ['steps[]', 'per campus, in order: school_id, school, has_agreement, additional_courses, blocked_receivers'],
        ],
      },
      {
        method: 'GET',
        path: '/analysis/category-gaps',
        title: 'Which kinds of course block transfer, where',
        plain:
          'Per campus × course category: the share of colleges missing an articulated equivalent. Uses the curation tags; untagged receivers land in category null.',
        returns: '{ dataset_version, params, n, rows: [...] }',
        fields: [
          ['category', 'canonical category from curation (null = untagged)'],
          ['ccs_with_requirement, ccs_missing_articulation, pct_missing', 'the gap measure'],
        ],
      },
      {
        method: 'GET',
        path: '/analysis/complexity',
        title: 'How tangled the prerequisite path is',
        plain:
          'Delay/blocking complexity of each agreement\'s minimal pathway over the curated prerequisite graph. Check prereq_data_coverage_pct before trusting a row.',
        returns: '{ dataset_version, params, n, rows: [...] }',
        fields: [
          ['complexity, max_delay', 'the headline scores'],
          ['n_courses, n_prereq_edges, prereq_data_coverage_pct', 'pathway size and prereq-data completeness'],
          ['per_course[]', 'per course: key, delay, blocking'],
        ],
      },
      {
        method: 'GET',
        path: '/analysis/time-to-degree',
        title: 'What an associate degree is worth at transfer',
        plain:
          'Per curated associate degree × agreement: units that transfer, the credit rate, units lost, and the estimated cost of the loss. Empty until degrees are curated.',
        returns: '{ dataset_version, params, n, rows: [...] }',
        fields: [
          ['assoc_degree, assoc_degree_units', 'the curated degree'],
          ['transferable_units, transfer_credit_rate_pct, lost_units, est_lost_cost_usd', 'the value-at-transfer measures'],
        ],
      },
      {
        method: 'GET',
        path: '/analysis/raw/:collection',
        title: 'The working collections',
        plain:
          'Raw dump of one working collection: audit_results (human verdicts — doc_id joins agreement _id), the curation_* tables, or the ref_* reference data.',
        returns: '{ dataset_version, n, rows: [...] }',
      },
    ],
  },
  {
    id: 'figures',
    title: 'Figures — the shared gallery',
    blurb: 'What pmt.py talks to. Publish from a notebook; the team sees it in Data → Analysis.',
    endpoints: [
      {
        method: 'GET',
        path: '/client/pmt.py',
        title: 'The Python client',
        plain:
          'pmt.py with this API\'s address already baked in — fetch() returns DataFrames, publish() sends figures to the gallery. Also available with Copy/Download in Build & publish.',
        returns: 'the pmt.py source (text/x-python)',
      },
      {
        method: 'POST',
        path: '/figures',
        title: 'Publish a figure',
        plain:
          'What pmt.publish() calls: slug, title, optional caption/source_url, and base64 SVG/PNG/PDF renders. Republishing a slug replaces the previous version.',
        returns: '{ ok, slug, dataset_version }',
        fields: [
          ['slug', 'the figure\'s stable id: a-z 0-9 - _ (e.g. "coverage-heatmap")'],
          ['title, caption, source_url', 'what the gallery card shows'],
          ['dataset_version', 'the version the data was fetched at (pmt.py fills this in)'],
          ['formats', '{ svg (required), png, pdf } as base64'],
        ],
      },
      {
        method: 'GET',
        path: '/figures',
        title: 'The published figures',
        plain:
          'The gallery listing: every published figure\'s metadata and SVG, plus the current dataset_version for staleness checks.',
        returns: '{ dataset_version, figures: [ { slug, title, caption, author_label, dataset_version, svg, … } ] }',
      },
      {
        method: 'GET',
        path: '/figures/:slug/:format',
        title: 'Download a figure',
        plain:
          'The stored file — svg, 300-dpi png, or vector pdf. The pdf is what the paper\'s \\includegraphics wants.',
        returns: 'the binary file',
      },
    ],
  },
  {
    id: 'single',
    title: 'Single-document reads',
    blurb: 'What the console UI itself calls — for spot-checking one agreement or institution.',
    endpoints: [
      {
        method: 'GET',
        path: '/uc-agreements-batch/:ccId?school_id=:ucId',
        title: "One college's agreements, grouped by campus",
        plain:
          'Resolves a (college, campus, major) pick to an agreement — optionally filtered to one campus with school_id.',
        returns: '[ { school_id, agreements: [...] }, ... ]',
      },
      {
        method: 'GET',
        path: '/audit/doc/:agreementId',
        title: 'One agreement, ready to read',
        plain:
          'A single agreement plus course-name maps and its ASSIST.org link — everything needed to eyeball an agreement your stats flagged.',
        returns: '{ doc, course_names, university_courses, assist_url, ... }',
      },
      {
        method: 'GET',
        path: '/data/raw-assist/:agreementId',
        title: 'The upstream ASSIST payload',
        plain:
          'The raw ASSIST.org response the parser consumed — ground truth for parser-fidelity checks. Live upstream fetch, so slower.',
        returns: 'the raw ASSIST JSON',
      },
      {
        method: 'GET',
        path: '/courses/:ccId',
        title: "One college's catalog rows",
        plain:
          'Filtered form of /export/courses for interactive lookups — pull the whole catalog once for analysis instead.',
        returns: '[ course rows ]',
      },
      {
        method: 'GET',
        path: '/university-courses/:ucId',
        title: "One campus's catalog rows",
        plain:
          'Filtered form of /export/university-courses — the receiving courses agreements articulate to there.',
        returns: '[ university course rows ]',
      },
    ],
  },
]

// ───────────────────────── the data guide ─────────────────────────

export const GUIDE_SECTIONS = [
  {
    id: 'what',
    title: 'The dataset',
    blocks: [
      {
        type: 'p',
        text:
          'Articulation agreements between California community colleges and UC campuses, parsed from ASSIST.org. One agreement exists per (college × campus × major): the campus\'s requirements for that major, and how — or whether — each can be satisfied at that college.',
      },
      {
        type: 'p',
        text:
          'The dataset is versioned. Every response carries dataset_version — record it beside anything you publish.',
      },
    ],
  },
  {
    id: 'shape',
    title: 'The shape of an agreement',
    blocks: [
      {
        type: 'code',
        text:
`agreement                     "De Anza → UCSD, Computer Science B.S."
└─ requirement_groups[]       "complete A and B and C" (or one-of, or N-of)
   └─ sections[]              blocks inside a group
      └─ receivers[]          ← ONE campus requirement each (the atom)`,
      },
      {
        type: 'p',
        text:
          'The receiver is the unit almost every analysis works in: "the campus wants this" plus "here is how you satisfy it at this college". /export/receivers gives you exactly these leaves, one per row, tree context flattened on.',
      },
    ],
  },
  {
    id: 'receiver',
    title: 'Reading a receiver',
    blocks: [
      { type: 'p', text: 'What the campus asks for comes in four kinds:' },
      {
        type: 'table',
        head: ['kind', 'meaning', 'joins to'],
        rows: [
          ['course', 'a single university course', 'receiving.parent_id → university_courses'],
          ['series', 'several university courses as a unit', 'receiving.parent_ids[] → university_courses'],
          ['requirement', 'a free-text rule, no course behind it', '—'],
          ['ge_area', 'a general-education area', 'receiving.code'],
        ],
      },
      {
        type: 'p',
        text: 'When articulation_status is "not_articulated", the reason decides whether it counts as a gap:',
      },
      {
        type: 'table',
        head: ['not_articulated_reason', 'meaning', 'a gap?'],
        rows: [
          ['no_course_articulated', 'the college has no articulated equivalent', 'yes — the real gap'],
          ['must_take_at_university', 'meant to be taken after transfer', 'usually no'],
          ['never_articulated', 'campus never accepts CC equivalents here', 'campus policy — report separately'],
          ['missing_articulation_entry', 'parser-internal absence', 'treat as unknown'],
        ],
      },
      {
        type: 'p',
        text:
          'The satisfying side is options[] — each option one acceptable CC course combination. Within an option, "and" = take all, "or" = any one; options_conjunction works the same across options:',
      },
      {
        type: 'code',
        text:
`{ "receiving": { "kind": "course", "parent_id": 292039 },
  "articulation_status": "articulated",
  "options": [
    { "course_ids": [195603],         "course_conjunction": "and" },  // 195603 alone…
    { "course_ids": [353175, 353176], "course_conjunction": "and" }   // …or BOTH of these
  ],
  "options_conjunction": "or" }`,
      },
      {
        type: 'p',
        text:
          'Several CC courses for one campus course — the second option here — is what credit-loss counts as many_to_one.',
      },
    ],
  },
  {
    id: 'required',
    title: 'What counts as required',
    blocks: [
      {
        type: 'table',
        head: ['field', 'rule'],
        rows: [
          ['is_required = false', 'the whole group is recommended — exclude from strict stats'],
          ['group_conjunction = "Or"', 'ONE of the group\'s sections suffices'],
          ['group_advisement = N', 'any N receivers across the group'],
          ['group_unit_advisement = N', 'N units across the group (overrides section advisements)'],
          ['section_advisement = N', 'any N receivers in the section (null = all)'],
          ['section_unit_advisement = N', 'N units in the section'],
        ],
      },
      {
        type: 'p',
        text:
          'The gap rule used throughout the precomputed analyses: is_required AND articulation_status = "not_articulated", usually excluding reason "must_take_at_university". Apply the same rule when recomputing from /export/receivers.',
      },
    ],
  },
  {
    id: 'joins',
    title: 'Joining the tables',
    blocks: [
      {
        type: 'table',
        head: ['from', 'to'],
        rows: [
          ['options[].course_ids[i]', 'courses.course_id'],
          ['receiving.parent_id / parent_ids[]', 'university_courses.parent_id'],
          ['school_id (= university_courses.university_id)', 'schools.uc[].id'],
          ['community_college_id', 'community-colleges id'],
          ['agreement _id', 'audit_results.doc_id'],
          ['receiver hash_id', 'curation_receiver_overrides._id'],
          ['university parent_id', 'curation_course_categories._id'],
        ],
      },
      {
        type: 'p',
        text:
          'In CSV exports, list/object columns (options, parent_ids, steps, …) arrive JSON-encoded — json.loads them first.',
      },
    ],
  },
  {
    id: 'which',
    title: 'Which endpoint answers which question',
    blocks: [
      {
        type: 'table',
        head: ['question', 'endpoint'],
        rows: [
          ['How complete is articulation, college × campus?', '/analysis/coverage'],
          ['How many courses/units does the cheapest path need?', '/analysis/credit-loss'],
          ['What does a 2nd/3rd campus choice cost?', '/analysis/choice-cost?schoolIds=… (ordered)'],
          ['Which course categories block transfer where?', '/analysis/category-gaps'],
          ['How prerequisite-tangled is the pathway?', '/analysis/complexity'],
          ['How much of an associate degree transfers?', '/analysis/time-to-degree'],
          ['Anything receiver-level the above don\'t cover', '/export/receivers + pandas'],
          ['How reliable is the parsed data?', '/analysis/raw/audit_results'],
        ],
      },
      {
        type: 'p',
        text:
          'Prefer the precomputed endpoints — they already handle required-vs-recommended logic, option solving, and calendar normalization.',
      },
    ],
  },
  {
    id: 'campuses',
    title: 'Campus ids',
    blocks: [
      {
        type: 'table',
        head: ['campus', 'id'],
        rows: [
          ['UC Berkeley', '79'], ['UC Davis', '89'], ['UC Irvine', '120'], ['UCLA', '117'],
          ['UC Merced', '144'], ['UC Riverside', '46'], ['UC San Diego', '7'],
          ['UC Santa Barbara', '128'], ['UC Santa Cruz', '132'],
        ],
      },
    ],
  },
]

// ───────────────────────── build & publish ─────────────────────────

export const curlBootstrap = (base) =>
  `curl -H "Authorization: Bearer pmtr_..." ${base}/client/pmt.py -o pmt.py`

export const PUBLISH_STEPS = [
  ['Create a token', 'Tokens tab → Generate token. That string is your API password for scripts — keep it out of shared notebooks.'],
  ['Get pmt.py', 'Copy or download it below — it comes preconfigured with this API\'s address. Drop it next to your notebook or script.'],
  ['Write your figure', 'Ordinary pandas + matplotlib in your own IDE or notebook. pmt.fetch("/analysis/…") returns DataFrames.'],
  ['Publish', 'pmt.publish(fig, slug="…", title="…") — the figure appears in Data → Analysis for the whole team, stamped with the dataset version it was computed from. Republish the same slug to update it.'],
]

export const EXAMPLE_FIGURE_SCRIPT = `import matplotlib.pyplot as plt
import pmt

pmt.TOKEN = "pmtr_..."          # or: export PMT_TOKEN before launching

cov = pmt.fetch("/analysis/coverage")
heat = cov.pivot_table(index="community_college", columns="school",
                       values="pct_articulated")

fig, ax = plt.subplots(figsize=(8, 10))
im = ax.imshow(heat.fillna(0), aspect="auto")
ax.set_yticks(range(len(heat.index)), heat.index, fontsize=5)
ax.set_xticks(range(len(heat.columns)), heat.columns, rotation=45, ha="right")
fig.colorbar(im, label="% articulated")

pmt.publish(fig, slug="coverage-heatmap",
            title="Articulation coverage, college × campus")`

// ───────────────────────── the AI paste ─────────────────────────

const mdTable = (head, rows) => [
  `| ${head.join(' | ')} |`,
  `| ${head.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
].join('\n')

const mdBlock = (b) => {
  if (b.type === 'p') return b.text
  if (b.type === 'code') return '```\n' + b.text + '\n```'
  if (b.type === 'table') return mdTable(b.head, b.rows)
  if (b.type === 'list') return b.items.map((i) => `- ${i}`).join('\n')
  return ''
}

const mdEndpoint = (e) => {
  const parts = [`### ${e.method} ${e.path} — ${e.title}`, e.plain]
  if (e.returns) parts.push(`Returns: \`${e.returns}\``)
  if (e.fields?.length) parts.push(e.fields.map(([f, d]) => `- \`${f}\` — ${d}`).join('\n'))
  if (e.example) parts.push('```python\n' + e.example + '\n```')
  return parts.join('\n\n')
}

/**
 * The one block to paste into an AI assistant (alongside a pmtr_ token) so it
 * can write analysis scripts against the live API. Same source objects as the
 * rendered docs — humans read the page, the AI reads this.
 */
export function buildAiBriefing(base) {
  return [
    '# PMT Research API — data briefing',
    'You are working against a private research API over California community-college → UC transfer-articulation data (parsed from ASSIST.org). This briefing is the complete reference: access, endpoints, data model, and analysis rules.',
    '## Access',
    [
      `- Base URL: ${base}`,
      `- Every request: \`${AUTH_HEADER}\` (tokens start with pmtr_)`,
      ...GETTING_STARTED_NOTES.map((n) => `- ${n}`),
    ].join('\n'),
    '```python\n' + pythonSnippet(base) + '\n```',
    '## Endpoints',
    ...ENDPOINT_GROUPS.flatMap((g) => [`### ${g.title}`, ...g.endpoints.map(mdEndpoint)]),
    '## Publishing figures to the team gallery',
    'Figures are shared through the console: download the client once (`' + curlBootstrap(base) + '`), write ordinary pandas + matplotlib, and call pmt.publish(fig, slug, title) — the figure appears in the console\'s Data → Analysis gallery for the whole team, stamped with the dataset_version it was computed from. When asked to produce an analysis or figure, end scripts with a pmt.publish call.',
    PUBLISH_STEPS.map(([t, d]) => `- ${t}: ${d}`).join('\n'),
    '```python\n' + EXAMPLE_FIGURE_SCRIPT + '\n```',
    '## Data model & analysis rules',
    ...GUIDE_SECTIONS.flatMap((s) => [`### ${s.title}`, ...s.blocks.map(mdBlock)]),
  ].join('\n\n')
}
