// Per-campus verification paths for the hand-gathered 4-year degree templates.
//
// Distilled from docs/figures/degree-coverage-sources.md — the authoritative
// provenance record. Each campus lists the official pages to walk, in order,
// to hand-verify the template, with a note on what each page covers. Modeling
// decisions live in the doc and in the page's editable verification notes.
// If a campus's requirements are re-gathered from new pages, update BOTH the
// doc and this map.
//
// Historical CS entries are keyed by numeric ASSIST `school_id`. New entries
// use `<major_slug>:<school_id>` so a Biology or Economics degree can never
// inherit the CS verification path merely because it belongs to the same UC.

const DEGREE_SOURCES = {
  // UC Berkeley — EECS B.S.
  79: [
    {
      label: 'Berkeley Catalog — EECS B.S. requirements',
      url: 'https://undergraduate.catalog.berkeley.edu/programs/16306U/requirements-krhha',
      note: 'All major coursework: lower-division math / physics / CS / EECS series, the natural-science elective options, and the upper-division 20-unit + design-course and ethics rules.',
    },
    {
      label: 'College of Engineering — degree requirements',
      url: 'https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/',
      note: 'The six-course H/SS breadth requirement and the 120-unit / academic requirements.',
    },
    {
      label: 'College of Engineering — H/SS breadth details',
      url: 'https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/humanities-and-social-sciences/',
      note: 'The fine print: 2 of the 6 are Reading & Composition, and at least 2 must be upper-division (100–196) — which is why 2 breadth slots are scored at-the-university.',
    },
    {
      label: 'UC Admissions — IGETC campus guidance',
      url: 'https://admission.universityofcalifornia.edu/admission-requirements/transfer-requirements/preparing-to-transfer/general-education-igetc/campus-guidance.html',
      note: 'Berkeley Engineering does not accept IGETC for breadth — why breadth here is scored per-course by GE area.',
    },
  ],
  // UC San Diego — Computer Science B.S. (CS26)
  7: [
    {
      label: 'UCSD CSE — B.S. Computer Science Major Checklist, Fall 2026 (CSE-BS-002)',
      url: 'https://drive.google.com/file/d/1hLg7rehInSV9pra_1RYuPq8Rsi4IEwXc/view',
      note: null,
    },
    {
      label: 'Warren College — General Education Requirements',
      url: 'https://warren.ucsd.edu/academics/general-education/index.html',
      note: null,
    },
  ],
  // UC Riverside — Computer Science B.S.
  46: [
    {
      label: 'UCR BCOE — Computer Science Suggested Course Plan (catalog year 2025)',
      url: 'https://student.engr.ucr.edu/course-plans/2025/09/25/computer-science',
      note: null,
    },
  ],
  // UC Davis — Computer Science B.S.
  89: [
    {
      label: 'UC Davis Catalog — Computer Science B.S.',
      url: 'https://catalog.ucdavis.edu/departments-programs-degrees/computer-science-engineering/computer-science-bs/',
      note: 'All major coursework: MAT 21 series + linear algebra, ECS 20 / 36A–C / 50, the choose-3 science block, and upper-division requirements.',
    },
    {
      label: 'UC Davis CS Department — major checklist (PDF)',
      url: 'https://cs.ucdavis.edu/sites/g/files/dgvnsk8441/files/media/documents/CS%20Major%20Checklist_0.pdf',
      note: 'The department’s own checklist — the series rules (ECS 36 in its entirety) and the 7-core + 7-elective upper division.',
    },
    {
      label: 'UC Davis Catalog — General Education requirements',
      url: 'https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/general-education-ge-requirements/',
      note: 'States transfer students who complete IGETC/Cal-GETC are exempt from ALL GE — why GE is modeled as one Cal-GETC row.',
    },
    {
      label: 'UC Davis Catalog — American History & Institutions',
      url: 'https://catalog.ucdavis.edu/undergraduate-education/university-degree-requirements/american-history-institutions-requirement/',
      note: 'UC-wide graduation rule, separate from GE — satisfiable with high-school U.S. history, which is why it is assumed satisfiable.',
    },
    {
      label: 'UC Davis Registrar — bachelor’s degree requirements',
      url: 'https://registrar.ucdavis.edu/registration/plan/bach-reqs',
      note: '180 total units with 64 upper-division — the rule behind the elective split: 8u forced upper-division, 14u CC-transferable (to the 105-quarter-unit cap), 7u any-level at Davis.',
    },
  ],
  // UCLA — Computer Science B.S.
  117: [
    {
      label: 'UCLA Catalog — Computer Science B.S. (2026)',
      url: 'https://catalog.registrar.ucla.edu/major/2026/ComputerScienceBS',
      note: null,
    },
    {
      label: 'UCLA Catalog — Samueli School Requirements: General Education',
      url: 'https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/HenrySamueliSchoolofEngineeringandAppliedScience/School-Requirements/General-Education-Requirements',
      note: null,
    },
    {
      label: 'UCLA Catalog — Samueli School Requirements: Writing',
      url: 'https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/HenrySamueliSchoolofEngineeringandAppliedScience/School-Requirements/Writing-Requirement',
      note: null,
    },
    {
      label: 'UCLA Catalog — Samueli School Requirements (units, ethics, residency)',
      url: 'https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/HenrySamueliSchoolofEngineeringandAppliedScience/School-Requirements',
      note: null,
    },
  ],
  // UC Irvine — Computer Science B.S.
  120: [
    {
      label: 'UCI Catalogue — Computer Science B.S.',
      url: 'https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/',
      note: 'All major coursework: MATH 2A/2B + linear algebra, STATS 67, the I&C SCI programming series, and upper-division requirements.',
    },
    {
      label: 'UCI Catalogue — General Education requirement',
      url: 'https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#generaleducationrequirementtext',
      note: null,
    },
  ],
  // UC Santa Barbara — Computer Science B.S.
  128: [
    {
      label: 'UCSB CS Department — Undergraduate Current Students (major requirements + science electives)',
      url: 'https://cs.ucsb.edu/education/undergraduate/current-students',
      note: null,
    },
    {
      label: 'UCSB College of Engineering — Undergraduate Requirements',
      url: 'https://engineering.ucsb.edu/undergraduate/academic-advising/undergraduate-requirements',
      note: null,
    },
    {
      label: 'UCSB College of Engineering — 2024–25 GEAR (PDF)',
      url: 'https://engineering.ucsb.edu/sites/default/files/24-25_GEAR_DIGITAL.pdf',
      note: null,
    },
  ],
  // UC Santa Cruz — Computer Science B.S.
  132: [
    {
      label: 'UCSC Baskin Engineering — CS B.S. 2025–26 Curriculum Chart (PDF)',
      url: 'https://undergrad.engineering.ucsc.edu/files/2025/09/CS_BS_25-26.pdf',
      note: null,
    },
    {
      label: 'UCSC Registrar — General Education Requirements',
      url: 'https://registrar.ucsc.edu/enrollment/general-education-requirements.html',
      note: null,
    },
    {
      label: 'UCSC Catalog — IGETC (satisfies all GE except DC)',
      url: 'https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/credit-for-transfer-students/intersegmental-general-education-transfer-curriculum-igetc/',
      note: null,
    },
  ],
  // UC Merced — Computer Science and Engineering B.S.
  144: [
    {
      label: 'UC Merced Catalog — Computer Science and Engineering B.S. (2026–27)',
      url: 'https://catalog.ucmerced.edu/preview_program.php?catoid=26&poid=4233',
      note: null,
    },
    {
      label: 'UC Merced GE Office — Current GE Requirements (incl. CC transfer articulation table)',
      url: 'https://ge.ucmerced.edu/students/ge-requirements/current-ge-requirements',
      note: null,
    },
  ],
}

// Verification path for a served degree document; falls back to the
// document's own single source_url when the campus isn't in the map.
export function degreeSourcesFor(doc) {
  const schoolId = Number(doc?.school_id)
  const majorSlug = String(doc?.major_slug || 'cs')
  const sources = DEGREE_SOURCES[`${majorSlug}:${schoolId}`]
    || (majorSlug === 'cs' ? DEGREE_SOURCES[schoolId] : null)
  if (sources?.length) return sources
  if (Array.isArray(doc?.sources) && doc.sources.length) {
    return doc.sources
      .filter((source) => source?.url)
      .map((source) => ({
        label: source.label || source.kind || 'Source',
        url: source.url,
        note: source.note || null,
      }))
  }
  if (doc?.source_url) return [{ label: 'Source', url: doc.source_url, note: null }]
  return []
}

export default DEGREE_SOURCES
