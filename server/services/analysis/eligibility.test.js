/**
 * Fidelity oracle for the vendored PMT eligibility port. Mirrors the Python
 * harness (analysis/tests/test_pmt_fidelity.py): for every committed PMT golden,
 * derive the same six deterministic scenarios and assert the port reproduces the
 * eligibility fields PMT locked into <name>.outcomes.json. Display-only fields
 * are not ported and not compared. strict is OFF here — this locks faithful
 * fidelity to PMT (the modification is exercised by the modification tests).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isMajorCompleted, isGroupCompleted, isSectionCompleted, isReceiverCompleted,
  isReceiverAvailable, getEffectiveGroupAsk, sectionContribution, sectionMaxContribution,
  calculateMajorCompletionPercentage, isMajorArticulable,
} from './eligibility';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDENS_DIR = path.resolve(__dirname, '../../../analysis/tests/fixtures/pmt_goldens');

const round2 = (n) => Math.round(n * 100) / 100;

// --- deterministic scenario derivation (port of PMT frontend fidelity/scenarios.js) ---
function minimalCourseIds(receiver) {
  if (!receiver || receiver.articulation_status !== 'articulated') return [];
  const options = receiver.options || [];
  if (options.length === 0) return [];
  const conj = (receiver.options_conjunction || 'and').toLowerCase();
  const chosen = conj === 'and' ? options : options.slice(0, 1);
  const ids = [];
  for (const opt of chosen) {
    const courseIds = opt?.course_ids || [];
    if (courseIds.length === 0) continue;
    const courseConj = (opt.course_conjunction || 'and').toLowerCase();
    if (courseConj === 'or') ids.push(courseIds[0]);
    else ids.push(...courseIds);
  }
  return ids;
}
const syntheticCourse = (courseId, grade) => ({
  course_id: courseId, course_grade: grade, course_units: 3,
  prefix: 'GLD', number: String(courseId), same_as: [], community_college_name: 'Golden CC',
});
function coursesFor(receivers, grade) {
  const seen = new Set();
  const courses = [];
  for (const receiver of receivers) {
    for (const id of minimalCourseIds(receiver)) {
      if (seen.has(id)) continue;
      seen.add(id);
      courses.push(syntheticCourse(id, grade));
    }
  }
  return courses;
}
function eachReceiver(parsed) {
  const out = [];
  for (const group of parsed?.requirement_groups || []) {
    for (const section of group.sections || []) {
      (section.receivers || []).forEach((receiver, indexInSection) => out.push({ receiver, indexInSection }));
    }
  }
  return out;
}
function exactAskReceivers(parsed) {
  const out = [];
  for (const group of parsed?.requirement_groups || []) {
    let remaining = group.group_advisement != null ? group.group_advisement : null;
    for (const section of group.sections || []) {
      const articulated = (section.receivers || []).filter((r) => r.articulation_status === 'articulated');
      let take;
      if (remaining != null) {
        const cap = section.section_advisement != null ? section.section_advisement : articulated.length;
        take = Math.min(cap, articulated.length, Math.max(0, remaining));
        remaining -= take;
      } else {
        take = section.section_advisement != null ? Math.min(section.section_advisement, articulated.length) : articulated.length;
      }
      out.push(...articulated.slice(0, take));
    }
  }
  return out;
}
function deriveScenarios(parsed) {
  const flat = eachReceiver(parsed);
  const allReceivers = flat.map((f) => f.receiver);
  const evenReceivers = flat.filter((f) => f.indexInSection % 2 === 0).map((f) => f.receiver);
  const crossCc = allReceivers
    .filter((r) => r.articulation_status === 'not_articulated' && r.hash_id)
    .map((r) => ({ hash_id: r.hash_id }));
  return {
    empty: { userCourses: [], crossCc: [] },
    half: { userCourses: coursesFor(evenReceivers, 'A'), crossCc: [] },
    exact_ask: { userCourses: coursesFor(exactAskReceivers(parsed), 'A'), crossCc: [] },
    all: { userCourses: coursesFor(allReceivers, 'A'), crossCc: [] },
    all_d_grades: { userCourses: coursesFor(allReceivers, 'D'), crossCc: [] },
    crosscc: { userCourses: [], crossCc },
  };
}

// --- eligibility-only projections ------------------------------------------
function mine(parsed, { userCourses: uc, crossCc: cc }) {
  const major = { requirement_groups: parsed.requirement_groups };
  return {
    major: {
      completed: isMajorCompleted(major, uc, cc),
      percentage: round2(calculateMajorCompletionPercentage(major, uc, cc)),
    },
    groups: (parsed.requirement_groups || []).map((g) => ({
      completed: isGroupCompleted(g, uc, cc),
      effectiveAsk: getEffectiveGroupAsk(g, cc),
      sections: (g.sections || []).map((s) => ({
        completed: isSectionCompleted(s, uc, cc),
        contribution: sectionContribution(s, uc, cc),
        maxContribution: sectionMaxContribution(s, cc),
        receivers: (s.receivers || []).map((r) => ({
          completed: isReceiverCompleted(r, uc, cc),
          available: isReceiverAvailable(r, cc),
        })),
      })),
    })),
  };
}
function goldenProjection(o) {
  return {
    major: { completed: o.major.completed, percentage: round2(o.major.percentage) },
    groups: o.groups.map((g) => ({
      completed: g.completed,
      effectiveAsk: g.effectiveAsk,
      sections: g.sections.map((s) => ({
        completed: s.completed,
        contribution: s.contribution,
        maxContribution: s.maxContribution,
        receivers: s.receivers.map((r) => ({ completed: r.completed, available: r.available })),
      })),
    })),
  };
}

const goldenFiles = fs.existsSync(GOLDENS_DIR)
  ? fs.readdirSync(GOLDENS_DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.outcomes.json')).sort()
  : [];
const SCENARIOS = ['empty', 'half', 'exact_ask', 'all', 'all_d_grades', 'crosscc'];

describe('PMT eligibility port — fidelity to golden outcomes', () => {
  it('has the golden corpus', () => {
    expect(goldenFiles.length).toBeGreaterThan(0);
  });

  for (const file of goldenFiles) {
    const base = file.replace(/\.json$/, '');
    const golden = JSON.parse(fs.readFileSync(path.join(GOLDENS_DIR, file), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(GOLDENS_DIR, `${base}.outcomes.json`), 'utf8')).outcomes;
    const scenarios = deriveScenarios(golden.parsed);
    for (const sid of SCENARIOS) {
      it(`${base} :: ${sid}`, () => {
        expect(mine(golden.parsed, scenarios[sid])).toEqual(goldenProjection(expected[sid]));
      });
    }
  }
});

describe('the deliberate modification (strict)', () => {
  const art = (pid, cid) => ({
    receiving: { kind: 'course', parent_id: pid }, articulation_status: 'articulated',
    options: [{ course_ids: [cid], course_conjunction: 'and' }], options_conjunction: 'and', hash_id: `h${pid}`,
  });
  const unart = (pid) => ({
    receiving: { kind: 'course', parent_id: pid }, articulation_status: 'not_articulated',
    not_articulated_reason: 'no_course_articulated', options: [], options_conjunction: 'and', hash_id: `h${pid}`,
  });
  const sec = (receivers, extra = {}) => ({ section_advisement: null, unit_advisement: null, receivers, ...extra });
  const grp = (sections, extra = {}) => ({
    is_required: true, group_conjunction: 'And', group_advisement: null, group_unit_advisement: null,
    group_min_distinct_sections: null, group_max_distinct_sections: null, group_section_min_courses: null,
    sections, ...extra,
  });
  const major = (...groups) => ({ requirement_groups: groups });

  it('choose 1 of 3 with 2 articulated is articulable (UCB × Marin pattern)', () => {
    const m = major(grp([sec([art(54, 116), unart(160), art(56, 116)], { section_advisement: 1 })]));
    expect(isMajorArticulable(m, true)).toBe(true);
  });
  it('choose 2 of 3 with 1 articulated: gap under strict, accepted faithful', () => {
    const m = major(grp([sec([art(1, 101), unart(2), unart(3)], { section_advisement: 2 })]));
    expect(isMajorArticulable(m, true)).toBe(false);
    expect(isMajorArticulable(m, false)).toBe(true);
  });
  it('fully unarticulated required section: strict blocks, faithful accepts', () => {
    const m = major(grp([sec([unart(1), unart(2)], { section_advisement: 2 })]));
    expect(isMajorArticulable(m, true)).toBe(false);
    expect(isMajorArticulable(m, false)).toBe(true);
  });
  it('recommended unarticulated group does not block', () => {
    const m = major(
      grp([sec([art(1, 101)], { section_advisement: 1 })]),
      grp([sec([unart(2), unart(3)], { section_advisement: 2 })], { is_required: false }),
    );
    expect(isMajorArticulable(m, true)).toBe(true);
  });
});
