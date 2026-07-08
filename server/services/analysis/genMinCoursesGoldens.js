/**
 * Golden generator for analysis/pmt_min_courses.py.
 *
 * Defines synthetic cases that exercise every requirement-advisement branch the
 * old ASSIST MILP dropped (unit advisements, D-buckets, max-distinct-sections,
 * bare OR sections, no-advisement "any one", same_as sharing, is_required=null),
 * optionally merges real single-agreement cases extracted by
 * analysis/tests/extract_real_min_courses_cases.py, runs the vendored optimizer
 * (greedy + optimal), and writes two committed fixtures the Python golden test
 * reads DB-free:
 *   analysis/tests/fixtures/min_courses_cases.json    (inputs)
 *   analysis/tests/fixtures/min_courses_goldens.json  (greedy + optimal outputs)
 *
 * Placed under server/services/analysis/ (not analysis/tests/) so require('./minCourses')
 * resolves. Run: node server/services/analysis/genMinCoursesGoldens.js
 */
const fs = require('fs');
const path = require('path');
const { selectMissingAcrossMajors, selectMissingAcrossMajorsOptimal } = require('./minCourses');

const FIX = path.resolve(__dirname, '../../../analysis/tests/fixtures');
const REAL = path.join(FIX, 'min_courses_real_cases.json');

// ---- builders ----
// `ru` = receiving-side (UC course) units, used by unit-advisement completion.
const rcv = (hash, courseIds, { conj = 'and', optConj = 'and', status = 'articulated', ru = undefined } = {}) => ({
  hash_id: hash,
  articulation_status: status,
  receiving: ru === undefined ? { kind: 'course', parent_id: hash } : { kind: 'course', parent_id: hash, units: ru },
  options_conjunction: optConj,
  options: [{ course_ids: courseIds, course_conjunction: conj }],
});
// options_conjunction 'and' sequence: every option must be satisfied (a series as one receiver)
const rcvSeq = (hash, idsPerOption) => ({
  hash_id: hash,
  articulation_status: 'articulated',
  receiving: { kind: 'series', parent_ids: idsPerOption.flat() },
  options_conjunction: 'and',
  options: idsPerOption.map((ids) => ({ course_ids: ids, course_conjunction: 'and' })),
});
const notArt = (hash) => ({ hash_id: hash, articulation_status: 'not_articulated', receiving: { kind: 'course', parent_id: hash }, options: [] });
const sec = (fields, receivers) => ({ ...fields, receivers });
const grp = (fields, sections) => ({ is_required: true, ...fields, sections });
const cat = (obj) => Object.fromEntries(Object.entries(obj).map(([id, v]) => [id, { course_id: id, units: v.units, same_as: v.same_as || [] }]));
const u = (units, same_as) => ({ units, same_as });

const CASES = [
  {
    case_id: 'all_two_mandatory',
    majors: [{ requirement_groups: [grp({}, [sec({}, [rcv('h1', ['c1'])]), sec({}, [rcv('h2', ['c2'])])])] }],
    coursesById: cat({ c1: u(3), c2: u(3) }),
  },
  {
    case_id: 'section_choose_2_of_4',
    majors: [{ requirement_groups: [grp({}, [sec({ section_advisement: 2 }, [rcv('h1', ['c1']), rcv('h2', ['c2']), rcv('h3', ['c3']), rcv('h4', ['c4'])])])] }],
    coursesById: cat({ c1: u(4), c2: u(3), c3: u(3), c4: u(5) }),
  },
  {
    case_id: 'group_advisement_2_across_sections',
    majors: [{ requirement_groups: [grp({ group_advisement: 2 }, [sec({}, [rcv('h1', ['c1']), rcv('h2', ['c2'])]), sec({}, [rcv('h3', ['c3']), rcv('h4', ['c4'])])])] }],
    coursesById: cat({ c1: u(5), c2: u(3), c3: u(4), c4: u(3) }),
  },
  {
    // Documents the optimizer's actual OR behavior: its DFS commits to closing
    // open receivers in traversal order, so it satisfies the first section (c1,c2)
    // rather than the globally cheaper lone c3. Rare in real data (2 groups / 1035
    // agreements) but locked so the port reproduces it exactly.
    case_id: 'group_or_two_sections_optimizer_commits_first',
    majors: [{ requirement_groups: [grp({ group_conjunction: 'Or' }, [sec({ section_advisement: 2 }, [rcv('h1', ['c1']), rcv('h2', ['c2'])]), sec({}, [rcv('h3', ['c3'])])])] }],
    coursesById: cat({ c1: u(3), c2: u(3), c3: u(3) }),
  },
  {
    case_id: 'section_unit_advisement_6',
    majors: [{ requirement_groups: [grp({}, [sec({ unit_advisement: 6 }, [rcv('h1', ['c1'], { ru: 3 }), rcv('h2', ['c2'], { ru: 3 }), rcv('h3', ['c3'], { ru: 3 })])])] }],
    coursesById: cat({ c1: u(4), c2: u(3), c3: u(3) }),
  },
  {
    case_id: 'group_unit_advisement_6',
    majors: [{ requirement_groups: [grp({ group_unit_advisement: 6 }, [sec({}, [rcv('h1', ['c1'], { ru: 3 })]), sec({}, [rcv('h2', ['c2'], { ru: 3 })]), sec({}, [rcv('h3', ['c3'], { ru: 3 })])])] }],
    coursesById: cat({ c1: u(3), c2: u(3), c3: u(3) }),
  },
  {
    case_id: 'group_min_distinct_sections_2',
    majors: [{ requirement_groups: [grp({ group_advisement: 2, group_min_distinct_sections: 2, group_section_min_courses: 1 },
      [sec({}, [rcv('h1', ['c1'])]), sec({}, [rcv('h2', ['c2'])]), sec({}, [rcv('h3', ['c3'])])])] }],
    coursesById: cat({ c1: u(5), c2: u(3), c3: u(3) }),
  },
  {
    case_id: 'group_max_distinct_sections_1',
    majors: [{ requirement_groups: [grp({ group_advisement: 2, group_max_distinct_sections: 1 },
      [sec({}, [rcv('h1', ['c1']), rcv('h2', ['c2'])]), sec({}, [rcv('h3', ['c3']), rcv('h4', ['c4'])])])] }],
    coursesById: cat({ c1: u(3), c2: u(3), c3: u(5), c4: u(5) }),
  },
  {
    case_id: 'no_advisement_multi_receiver_any_one',
    majors: [{ requirement_groups: [grp({}, [sec({}, [rcv('h1', ['c1']), rcv('h2', ['c2'])])])] }],
    coursesById: cat({ c1: u(4), c2: u(3) }),
  },
  {
    case_id: 'same_as_shared_two_majors',
    majors: [
      { requirement_groups: [grp({}, [sec({}, [rcv('ha', ['compA'])])])] },
      { requirement_groups: [grp({}, [sec({}, [rcv('hb', ['mathB'])])])] },
    ],
    coursesById: cat({ compA: u(3, [{ course_id: 'mathB' }]), mathB: u(3, [{ course_id: 'compA' }]) }),
  },
  {
    case_id: 'options_and_sequence_needs_both',
    majors: [{ requirement_groups: [grp({}, [sec({}, [rcvSeq('hs', [['c1'], ['c2']])])])] }],
    coursesById: cat({ c1: u(3), c2: u(3) }),
  },
  {
    case_id: 'option_course_or_cheapest',
    majors: [{ requirement_groups: [grp({}, [sec({}, [rcv('h1', ['c1', 'c2'], { conj: 'or' })])])] }],
    coursesById: cat({ c1: u(5), c2: u(3) }),
  },
  {
    case_id: 'is_required_null_group_ignored',
    majors: [{ requirement_groups: [
      grp({}, [sec({}, [rcv('h1', ['c1'])])]),
      { is_required: null, sections: [sec({}, [rcv('h2', ['c2'])])] },
    ] }],
    coursesById: cat({ c1: u(3), c2: u(3) }),
  },
  {
    case_id: 'choose_1_with_unarticulated_alternative',
    majors: [{ requirement_groups: [grp({}, [sec({ section_advisement: 1 }, [notArt('hx'), rcv('h2', ['c2'])])])] }],
    coursesById: cat({ c2: u(3) }),
  },
];

function toMapCtx(c) {
  return {
    userCourses: [],
    coursesById: new Map(Object.entries(c.coursesById)),
    includeRecommended: c.includeRecommended || false,
    crossCc: [],
  };
}

function main() {
  let cases = [...CASES];
  if (fs.existsSync(REAL)) {
    const real = JSON.parse(fs.readFileSync(REAL, 'utf8'));
    cases = cases.concat(real);
    console.error(`merged ${real.length} real cases from ${path.basename(REAL)}`);
  } else {
    console.error(`(no ${path.basename(REAL)} yet — synthetic cases only)`);
  }

  // Guard: every catalog entry must carry course_id — toSyntheticUserCourse reads it,
  // and an absent id silently makes completion fail (garbage goldens). Fail loud instead.
  for (const c of cases) {
    for (const [id, v] of Object.entries(c.coursesById)) {
      if (v.course_id === undefined || v.course_id === null) {
        throw new Error(`case ${c.case_id}: coursesById['${id}'] is missing course_id`);
      }
    }
  }

  const goldens = cases.map((c) => {
    const ctx = toMapCtx(c);
    return {
      case_id: c.case_id,
      greedy: selectMissingAcrossMajors(c.majors, ctx).map(String).sort(),
      optimal: selectMissingAcrossMajorsOptimal(c.majors, ctx).map(String).sort(),
    };
  });

  fs.mkdirSync(FIX, { recursive: true });
  fs.writeFileSync(path.join(FIX, 'min_courses_cases.json'), JSON.stringify(cases, null, 2) + '\n');
  fs.writeFileSync(path.join(FIX, 'min_courses_goldens.json'), JSON.stringify(goldens, null, 2) + '\n');
  console.error(`wrote ${cases.length} cases + goldens to ${FIX}`);
  for (const g of goldens) console.error(`  ${g.case_id}: optimal=[${g.optimal}] greedy=[${g.greedy}]`);
}

main();
