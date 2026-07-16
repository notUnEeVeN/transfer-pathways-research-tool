/**
 * Reference-table registry: label + editable field schema per table on Data →
 * References. RefRowModal renders the fields; server allowlists writable
 * collections (Curation.js REF_TABLES).
 *
 *   key      collection name
 *   label    tab/heading
 *   fields   row-editor fields { key, label, type, ... }
 *   makeId   _id for a new row (existing rows keep theirs)
 *   newRow   new-row defaults
 *   derive   optional: compute stored fields on save
 *
 * Field types: text | number | bool | tags | select | matched-course.
 */

const normCode = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim()
const slug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// UC code → { school_id, school }; mirrors the import script.
export const UC_SCHOOLS = {
  UCB: { school_id: 79, school: 'UC Berkeley' },
  UCD: { school_id: 89, school: 'UC Davis' },
  UCI: { school_id: 120, school: 'UC Irvine' },
  UCLA: { school_id: 117, school: 'UC Los Angeles' },
  UCM: { school_id: 144, school: 'UC Merced' },
  UCR: { school_id: 46, school: 'UC Riverside' },
  UCSD: { school_id: 7, school: 'UC San Diego' },
  UCSB: { school_id: 128, school: 'UC Santa Barbara' },
  UCSC: { school_id: 132, school: 'UC Santa Cruz' },
}

const UC_CODE_OPTIONS = Object.entries(UC_SCHOOLS).map(([code, v]) => ({ value: code, label: `${code} · ${v.school}` }))

export const REFERENCE_TABLES = [
  {
    key: 'transfer_minimums',
    label: 'UC minimum requirements',
    description:
      'The hard-minimum courses each UC major requires, by campus. Hand-curated — edit to refine, and link the UC course each requirement matches.',
    columns: ['school', 'group_id', 'set_id', 'receiving_code', 'matched'],
    fields: [
      { key: 'uc_code', label: 'UC campus', type: 'select', options: UC_CODE_OPTIONS },
      { key: 'group_id', label: 'Group', type: 'text', placeholder: 'e.g. Intro' },
      { key: 'set_id', label: 'Set (alternative)', type: 'text', placeholder: 'A' },
      { key: 'receiving_code', label: 'Required UC course', type: 'text', placeholder: 'CSE 8B' },
      { key: 'matched_courses', label: 'Matched UC course', type: 'matched-course' },
    ],
    campusIdField: 'school_id',
    derive: (row) => {
      const uc = UC_SCHOOLS[row.uc_code] || {}
      const matched_courses = Array.isArray(row.matched_courses) ? row.matched_courses : []
      const parent_ids = matched_courses
        .map((course) => Number(course.parent_id))
        .filter(Number.isFinite)
      return {
        ...row,
        school: uc.school ?? row.school ?? null,
        school_id: uc.school_id ?? row.school_id ?? null,
        normalized_code: normCode(row.receiving_code),
        matched: matched_courses.length > 0,
        matched_courses,
        parent_ids,
      }
    },
    makeId: (row) => `${row.uc_code}:${row.group_id}:${row.set_id}:${normCode(row.receiving_code).replace(/\s+/g, '_')}`,
    newRow: () => ({ uc_code: 'UCB', group_id: '', set_id: 'A', receiving_code: '', matched_courses: [] }),
    searchText: (r) => `${r.school} ${r.uc_code} ${r.group_id} ${r.receiving_code}`,
  },
  {
    key: 'community_college_geography',
    label: 'Community-college districts',
    description:
      'Which district each community college belongs to, plus its region and the counties it serves.',
    columns: ['_id', 'community_college', 'district', 'region', 'counties_served'],
    fields: [
      { key: '_id', label: 'CC id', type: 'number', idOnCreate: true, placeholder: 'community_college_id' },
      { key: 'community_college', label: 'Community college', type: 'text' },
      { key: 'district', label: 'District', type: 'text' },
      { key: 'region', label: 'Region', type: 'text' },
      { key: 'counties_served', label: 'Counties served', type: 'tags' },
    ],
    makeId: (row) => row._id,
    newRow: () => ({ _id: '', community_college: '', district: '', region: '', counties_served: [] }),
    searchText: (r) => `${r.community_college} ${r.district} ${r.region} ${(r.counties_served || []).join(' ')}`,
  },
  {
    key: 'course_prerequisites',
    label: 'Course prerequisites',
    description:
      'Hand-gathered prerequisite chains for community-college courses (e.g. Calculus II requires Calculus I).',
    columns: ['college', 'course_code', 'course_name', 'units', 'prerequisites'],
    fields: [
      { key: 'college', label: 'Community college', type: 'text' },
      { key: 'course_code', label: 'Course code', type: 'text', placeholder: 'MATH 1B' },
      { key: 'course_name', label: 'Course name', type: 'text' },
      { key: 'units', label: 'Units', type: 'number' },
      { key: 'prerequisites', label: 'Prerequisites (course codes)', type: 'tags' },
    ],
    makeId: (row) => `${slug(row.college)}:${normCode(row.course_code).replace(/\s+/g, '_')}`,
    newRow: () => ({ college: '', course_code: '', course_name: '', units: '', prerequisites: [] }),
    searchText: (r) => `${r.college} ${r.course_code} ${r.course_name}`,
  },
  {
    key: 'ge_patterns',
    label: 'GE patterns (Cal-GETC / UC-7)',
    description:
      'The general-education requirement structure — each area and subgroup and how many courses it requires. Hand-curated.',
    columns: ['pattern', 'area_code', 'area_name', 'subgroup_code', 'subgroup_name', 'required'],
    fields: [
      { key: 'pattern', label: 'Pattern', type: 'select', options: [{ value: 'calgetc', label: 'Cal-GETC' }, { value: 'uc7', label: 'UC-7' }] },
      { key: 'area_code', label: 'Area code', type: 'text', placeholder: '1' },
      { key: 'area_name', label: 'Area name', type: 'text' },
      { key: 'subgroup_code', label: 'Subgroup code', type: 'text', placeholder: '1A' },
      { key: 'subgroup_name', label: 'Subgroup name', type: 'text' },
      { key: 'required', label: 'Courses required', type: 'number' },
      { key: 'note', label: 'Note', type: 'text' },
    ],
    makeId: (row) => `${row.pattern}:${row.area_code}:${row.subgroup_code}`,
    newRow: () => ({ pattern: 'calgetc', area_code: '', area_name: '', subgroup_code: '', subgroup_name: '', required: 1, note: '' }),
    searchText: (r) => `${r.pattern} ${r.area_code} ${r.area_name} ${r.subgroup_code} ${r.subgroup_name}`,
  },
  {
    key: 'igetc_areas',
    label: 'IGETC areas',
    description:
      'The IGETC area structure — required courses and units per sub-area, with UC-vs-CSU notes.',
    columns: ['area_code', 'area_name', 'sub_area', 'sub_name', 'required_courses', 'required_units'],
    fields: [
      { key: 'area_code', label: 'Area', type: 'text', placeholder: 'Area 1' },
      { key: 'area_name', label: 'Area name', type: 'text' },
      { key: 'sub_area', label: 'Sub-area', type: 'text', placeholder: '1A' },
      { key: 'sub_name', label: 'Sub-area name', type: 'text' },
      { key: 'required_courses', label: 'Required courses', type: 'number' },
      { key: 'required_units', label: 'Required units', type: 'number' },
      { key: 'note', label: 'Note', type: 'text' },
    ],
    makeId: (row) => `${row.area_code}:${row.sub_area}`,
    newRow: () => ({ area_code: '', area_name: '', sub_area: '', sub_name: '', required_courses: 1, required_units: 3, note: '' }),
    searchText: (r) => `${r.area_code} ${r.area_name} ${r.sub_area} ${r.sub_name}`,
  },
  {
    key: 'prereq_concepts',
    label: 'Course concepts',
    description:
      'Canonical pathway concepts and their prerequisite rules — the normative statewide model courses map onto.',
    columns: ['slug', 'name', 'discipline', 'requires'],
    fields: [
      { key: 'slug', label: 'Slug', type: 'text', idOnCreate: true, placeholder: 'calc_2' },
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Calculus II' },
      {
        key: 'discipline', label: 'Discipline', type: 'select',
        options: ['math', 'physics', 'chem', 'cs', 'bio', 'engr', 'stats', 'other']
          .map((value) => ({ value, label: value })),
      },
      { key: 'requires', label: 'Requires (concept slugs)', type: 'tags' },
      { key: 'note', label: 'Note', type: 'text', placeholder: 'e.g. conservative: calc_3 required statewide' },
    ],
    makeId: (row) => row.slug,
    newRow: () => ({ slug: '', name: '', discipline: 'math', requires: [], note: '' }),
    searchText: (r) => `${r.slug} ${r.name} ${r.discipline} ${(r.requires || []).join(' ')}`,
  },
]

export function refTableByKey(key) {
  return REFERENCE_TABLES.find((t) => t.key === key) || null
}
