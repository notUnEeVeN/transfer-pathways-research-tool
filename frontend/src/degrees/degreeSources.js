// Per-campus verification paths for the hand-gathered 4-year degree templates.
//
// Distilled from docs/figures/degree-coverage-sources.md — the authoritative
// provenance record. Each campus lists the official pages to walk, in order,
// to hand-verify the template, with a note on what each page covers. Modeling
// decisions live in the doc and in the page's editable verification notes.
// If a campus's requirements are re-gathered from new pages, update BOTH the
// doc and this map.
//
// Keyed by the numeric ASSIST `school_id` carried on each served degree
// document (not the UCB/UCSD authoring keys in uc_degree_requirements.json).

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
      label: 'UCSD General Catalog — CSE undergraduate program',
      url: 'https://catalog.ucsd.edu/curric/CSE-ug.html',
      note: 'All CSE major coursework: lower-division math / CSE series, natural science, and upper-division core + electives.',
    },
    {
      label: 'UCSD CSE Department — B.S. Computer Science',
      url: 'https://cse.ucsd.edu/undergraduate/bs-computer-science',
      note: 'Department overview of the B.S. (CS26) — cross-check for the catalog.',
    },
  ],
  // UC Riverside — Computer Science B.S.
  46: [
    {
      label: 'UCR General Catalog 2025–2026 (PDF)',
      url: 'https://documents.ucr.edu/registrar/UCR%20Catalog%202025-2026.pdf',
      note: 'All major coursework — find the Computer Science B.S. (BCOE) section: calculus sequences, CS 10A–C / 61 / 11, physics, and the upper-division core + electives.',
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
      label: 'UCLA Samueli OASA — CS curriculum 2024–25',
      url: 'https://www.seasoasa.ucla.edu/curric-24-25/44-compsci-ugstd-24.html',
      note: 'All major coursework: MATH 31–33 series + 61, COM SCI 31/32/33/35L/M51A, PHYSICS 1A–C + lab, and the upper-division program.',
    },
  ],
  // UC Irvine — Computer Science B.S.
  120: [
    {
      label: 'UCI Catalogue — Computer Science B.S.',
      url: 'https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/',
      note: 'All major coursework: MATH 2A/2B + linear algebra, STATS 67, the I&C SCI programming series, and upper-division requirements.',
    },
  ],
  // UC Santa Barbara — Computer Science B.S.
  128: [
    {
      label: 'UCSB Catalog — Computer Science B.S.',
      url: 'https://catalog.ucsb.edu/programs/BSCMPSC',
      note: 'All major coursework: MATH 3A–6A, PSTAT 120A, the CMPSC lower-division series, and upper-division requirements.',
    },
  ],
  // UC Santa Cruz — Computer Science B.S.
  132: [
    {
      label: 'UCSC Catalog — Computer Science B.S.',
      url: 'https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-bs',
      note: 'All major coursework: MATH 19A/19B/21/23A and the CSE lower-division series, plus upper-division requirements.',
    },
  ],
  // UC Merced — Computer Science and Engineering B.S.
  144: [
    {
      label: 'UC Merced Catalog — Computer Science and Engineering B.S.',
      url: 'https://catalog.ucmerced.edu/preview_program.php?catoid=26&poid=4233',
      note: 'All major coursework: MATH 21–24/32, the CSE lower-division series, ENGR 65, physics + labs, and upper-division requirements.',
    },
  ],
}

// Verification path for a served degree document; falls back to the
// document's own single source_url when the campus isn't in the map.
export function degreeSourcesFor(doc) {
  const sources = DEGREE_SOURCES[Number(doc?.school_id)]
  if (sources?.length) return sources
  if (doc?.source_url) return [{ label: 'Source', url: doc.source_url, note: null }]
  return []
}

export default DEGREE_SOURCES
