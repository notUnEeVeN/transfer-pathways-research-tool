import { describe, expect, it } from 'vitest';
import {
  acquisitionTargets,
  buildAcquisitionPlan,
  catalogYearSeen,
  extractCourseLeafEntries,
  parseRobots,
  robotsAllows,
  structuredCourseLeafRequisiteFieldsValid,
} from './universityPrerequisiteAcquisition';
import {
  LONGWOOD_BOUNDARY_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
  LONGWOOD_CATALOG_CONTEXT_URL,
  LONGWOOD_DEPARTMENT_URL,
  LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
  LONGWOOD_DIRECT_CMSC_TARGETS,
} from './longwoodDepartmentPrerequisiteAcquisition';
import {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS,
  LONGWOOD_BANNER_URL,
} from './longwoodBannerCourseAcquisition';
import {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_DIRECT_COURSE_RECORDS,
  RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  expectedCourseUrl as expectedRadfordCourseUrl,
} from './radfordAcalogPrerequisiteAcquisition';
import {
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  UVA_WISE_DIRECT_COURSE_RECORDS,
  UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  expectedCourseUrl as expectedUvaWiseCourseUrl,
} from './uvaWiseAcalogPrerequisiteAcquisition';
import {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  expectedCourseUrl as expectedShenandoahCourseUrl,
} from './shenandoahAcalogPrerequisiteAcquisition';

describe('Virginia university prerequisite official acquisition', () => {
  it('bounds only a unique exact leading code inside a complete CourseLeaf block', () => {
    const html = `
      <div class="courseblock"><div><strong>CS 101</strong> Intro <strong>(3 Credits)</strong></div><div>Prerequisite: MATH 100.</div></div>
      <div class="courseblock"><div><strong>CS 102</strong> Next <strong>(3 Credits)</strong></div><div>Mentions CS 101.</div></div>
      <p>A degree list mentions CS 103 and CS 104.</p>`;
    const result = extractCourseLeafEntries(html, ['CS101', 'CS102', 'CS103']);
    expect(result.entries.map((row) => row.course_code)).toEqual(['CS101', 'CS102']);
    expect(result.entries[0].raw_entry_text).toContain('Prerequisite: MATH 100.');
    expect(result.entries[0]).toMatchObject({
      published_units: { credit_hours_min: 3, credit_hours_max: 3 },
      complete_entry_receipt: {
        source_courseblock_count: 2,
        source_complete_entry_count: 2,
        source_complete_entries_with_required_requisite_marker_count: 1,
        entry_required_requisite_marker_count: 1,
        entry_corequisite_marker_count: 0,
        same_source_positive_control: false,
      },
    });
    expect(result.entries[1].complete_entry_receipt).toMatchObject({
      entry_required_requisite_marker_count: 0,
      entry_requisite_marker_like_count: 0,
      entry_constraint_like_signal_count: 0,
      same_source_positive_control: true,
    });
    expect(result.missing).toEqual(['CS103']);
  });

  it('retains exact structural requisite fields when DOM text concatenates the marker', () => {
    const html = `
      <div class="courseblock">
        <div><strong>CS 149</strong> Intro</div>
        <span class="detail-hours_html"><strong>Credits</strong> 3</span>
        <div class="courseblockdesc">Enrollment is limited twice.</div><div class="courseblockextra">Prerequisites: MATH 155 or placement.</div>
      </div>`;
    const entry = extractCourseLeafEntries(html, ['CS149']).entries[0];
    expect(entry.raw_entry_text).toContain('twice.Prerequisites:');
    expect(entry.structured_requisite_fields).toEqual([
      expect.objectContaining({
        kind: 'prerequisite',
        label: 'Prerequisites',
        structural_class: 'courseblockextra',
        raw: 'MATH 155 or placement.',
        raw_field_html_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect(structuredCourseLeafRequisiteFieldsValid({
      ...entry, slug: 'james-madison-university',
    })).toBe(true);

    const tampered = structuredClone(entry);
    tampered.structured_requisite_fields[0].relative_start += 1;
    expect(structuredCourseLeafRequisiteFieldsValid({
      ...tampered, slug: 'james-madison-university',
    })).toBe(false);
  });

  it('does not classify administrative, sequencing, or recommendation text as clean silence', () => {
    const html = `
      <div class="courseblock"><div>CS 100 Intro (3 Credits)</div><div>Prerequisite: MATH 100.</div></div>
      <div class="courseblock"><div>CS 101 Survey (3 Credits)</div><div>Registration Restrictions: Open only to honors students.</div></div>
      <div class="courseblock"><div>CS 102 Lab (1 Credit)</div><div>Must be taken in conjunction with CS 101.</div></div>
      <div class="courseblock"><div>CS 103 Topics (3 Credits)</div><div>Some prior knowledge is recommended.</div></div>`;
    const result = extractCourseLeafEntries(html, ['CS101', 'CS102', 'CS103']);
    expect(result.entries).toHaveLength(3);
    expect(result.entries.every((row) => (
      row.complete_entry_receipt.same_source_positive_control === true
      && row.complete_entry_receipt.entry_constraint_like_signal_count > 0
    ))).toBe(true);
  });

  it('treats compact VT Pre-standing text as a constraint', () => {
    const html = `
      <div class="courseblock"><div>CEE 3014 Construction Management (3 credits)</div><div>Pre: Junior standing</div><div>Instructional Contact Hours</div></div>`;
    const result = extractCourseLeafEntries(html, ['CEE3014']);
    expect(result.entries.map((row) => (
      row.complete_entry_receipt.entry_constraint_like_signal_count
    ))).toEqual([1]);
  });

  it('rejects duplicate blocks and headings without published units', () => {
    const html = `
      <div class="courseblock"><div>CS 101 First (3 Credits)</div></div>
      <div class="courseblock"><div>CS 101 Duplicate (3 Credits)</div></div>
      <div class="courseblock"><div>CS 102 No unit label</div></div>`;
    const result = extractCourseLeafEntries(html, ['CS101', 'CS102']);
    expect(result.entries).toEqual([]);
    expect(result.ambiguous).toEqual([{ course_code: 'CS101', matching_blocks: 2 }]);
    expect(result.missing).toEqual(['CS102']);
  });

  it('uses the longest robots rule and preserves crawl delay', () => {
    const robots = parseRobots(`
      User-agent: *
      Disallow: /courses/
      Allow: /courses/math/
      Crawl-delay: 2
    `);
    expect(robots.crawl_delay_seconds).toBe(2);
    expect(robotsAllows(robots, '/courses/math/')).toBe(true);
    expect(robotsAllows(robots, '/courses/cs/')).toBe(false);
  });

  it('accepts only the scoped catalog edition in a captured page', () => {
    expect(catalogYearSeen('2026-2027 Academic Catalog', '2026-2027')).toBe(true);
    expect(catalogYearSeen('2026-27 Academic Catalog', '2026-2027')).toBe(true);
    expect(catalogYearSeen('2025-2026 Academic Catalog', '2026-2027')).toBe(false);
  });

  it('targets missing direct and uncaptured closure keys without double counting', () => {
    const scope = { universities: [{
      owner_namespace: 'va:uni:1',
      direct_named_course_codes: ['CS101', 'CS201'],
    }] };
    const candidates = { candidates: [{ course_key: 'va:uni:1:CS101' }] };
    const review = { closure: {
      unresolved_unparsed_direct: ['va:uni:1:CS101'],
      unresolved_missing_direct: ['va:uni:1:CS201'],
      unresolved_outside_direct_scope: ['va:uni:1:MATH100'],
    } };
    expect(acquisitionTargets({ scope, candidates, review })).toMatchObject({
      directMissing: ['va:uni:1:CS201'],
      closureGaps: ['va:uni:1:CS101', 'va:uni:1:CS201', 'va:uni:1:MATH100'],
      captureKeys: ['va:uni:1:CS201', 'va:uni:1:MATH100'],
    });
  });

  it('builds tested CourseLeaf routes and the pinned local CNU PDF route', () => {
    const scope = { snapshot_date: '2026-08-23', universities: [
      {
        school_id: 9210,
        slug: 'george-mason-university',
        owner_namespace: 'va:uni:9210',
        direct_named_course_codes: ['MATH113', 'MATH125'],
        cached_course_catalog: { official_url: 'https://catalog.gmu.edu/courses/cs/' },
      },
      {
        school_id: 9206,
        slug: 'christopher-newport-university',
        owner_namespace: 'va:uni:9206',
        direct_named_course_codes: ['CPSC150'],
        cached_course_catalog: { official_url: 'https://cnu.edu/catalog.pdf' },
      },
    ] };
    const plan = buildAcquisitionPlan({
      scope,
      candidates: { candidates: [] },
      review: { closure: {} },
    });
    expect(plan.routes).toEqual([
      expect.objectContaining({
        route_id: 'george-mason-university__math',
        official_url: 'https://catalog.gmu.edu/courses/math/',
        target_course_codes: ['MATH113', 'MATH125'],
      }),
      expect.objectContaining({
        route_id: 'christopher-newport-university__official_pdf_bbox_columns',
        platform: 'pdf_bbox_columns',
        cache_path: 'pages/christopher-newport-university__course_catalog.pdf',
        target_course_codes: ['CPSC150'],
        expected_pdf_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect(plan.blocked).toEqual([]);
    expect(plan.summary).toMatchObject({ tested_courseleaf_routes: 1, tested_pdf_routes: 1 });
  });

  it('uses sitemap-pinned VT subject indexes only for uncaptured recursive closure keys', () => {
    const owner = 'va:uni:9230';
    const scope = { snapshot_date: '2026-08-23', universities: [{
      school_id: 9230,
      slug: 'virginia-polytechnic-institute-and-state-university',
      owner_namespace: owner,
      catalog_year: '2026-2027',
      direct_named_course_codes: ['MATH1225'],
      cached_course_catalog: { official_url: 'https://catalog.vt.edu/course-search/' },
    }] };
    const candidates = { candidates: [{ course_key: `${owner}:MATH1225` }] };
    const review = { closure: { unresolved_outside_direct_scope: [
      `${owner}:ISC2105`, `${owner}:MATH2224`,
    ] } };
    const priorAcquisition = { entries: [{ course_key: `${owner}:MATH1225` }] };
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition });
    const courseRoutes = plan.routes.filter((row) => (
      row.platform === 'browser_challenge_courseleaf'
    ));
    expect(courseRoutes).toEqual([
      expect.objectContaining({
        official_url: 'https://catalog.vt.edu/undergraduate/college-science/mathematics/',
        target_course_codes: ['MATH1225'],
      }),
      expect.objectContaining({
        official_url: 'https://catalog.vt.edu/course-descriptions/isc/',
        target_course_codes: ['ISC2105'],
        recursive_closure_only: true,
      }),
      expect.objectContaining({
        official_url: 'https://catalog.vt.edu/course-descriptions/math/',
        target_course_codes: ['MATH2224'],
        recursive_closure_only: true,
      }),
    ]);
    expect(courseRoutes[0]).not.toHaveProperty('recursive_closure_only');
    expect(plan.routes.find((row) => row.platform === 'browser_challenge_sitemap'))
      .toMatchObject({ expected_discovered_paths: [
        '/course-descriptions/isc/',
        '/course-descriptions/math/',
        '/undergraduate/college-science/mathematics/',
      ] });
    expect(plan.blocked).toEqual([]);
  });

  it('routes Longwood direct CMSC and scoped Banner targets with the shared catalog context', () => {
    const other = ['CTZN110', 'ENGL165', 'MATH175'];
    const scope = { snapshot_date: '2026-08-23', universities: [{
      school_id: 9214,
      slug: 'longwood-university',
      owner_namespace: 'va:uni:9214',
      catalog_year: '2026-2027',
      direct_named_course_codes: [...LONGWOOD_DIRECT_CMSC_TARGETS, ...other],
      deterministic_resident_path_course_codes: [
        ...LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
        ...LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS,
      ].sort(),
      cached_course_catalog: {
        official_url: LONGWOOD_CATALOG_CONTEXT_URL,
        declared_normalized_text_sha256: LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
        retained_normalized_text_sha256: LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
        byte_match: true,
      },
    }] };
    const plan = buildAcquisitionPlan({
      scope, candidates: { candidates: [] }, review: { closure: {} },
    });
    expect(plan.routes).toEqual([
      expect.objectContaining({
        platform: 'longwood_department_course_listing',
        official_url: LONGWOOD_DEPARTMENT_URL,
        boundary_contract: LONGWOOD_BOUNDARY_CONTRACT,
        target_course_codes: [
          ...LONGWOOD_DIRECT_CMSC_TARGETS,
          ...LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
        ].sort(),
        department_page_catalog_year_statement: null,
      }),
      expect.objectContaining({
        platform: 'longwood_banner_course_listing',
        official_url: LONGWOOD_BANNER_URL,
        boundary_contract: LONGWOOD_BANNER_BOUNDARY_CONTRACT,
        target_course_codes: [
          ...other,
          ...LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS,
        ].sort(),
        department_page_catalog_year_statement: null,
      }),
    ]);
    expect(plan.blocked).toEqual([]);
    expect(plan.summary).toMatchObject({
      tested_longwood_department_routes: 1,
      tested_longwood_banner_routes: 1,
      route_target_keys: 24,
      owner_specific_blocked_keys: 0,
    });
  });

  it('routes only the exact pinned Radford direct roster at the published crawl delay', () => {
    const codes = Object.keys(RADFORD_DIRECT_COURSE_RECORDS);
    const scope = { snapshot_date: '2026-08-23', universities: [{
      school_id: 9223,
      slug: 'radford-university',
      owner_namespace: 'va:uni:9223',
      catalog_year: '2026-2027',
      direct_named_course_codes: codes,
      cached_course_catalog: {
        official_url: 'https://catalog.radford.edu/content.php?catoid=62&navoid=3427',
        byte_match: true,
      },
    }] };
    const plan = buildAcquisitionPlan({
      scope, candidates: { candidates: [] }, review: { closure: {} },
    });
    expect(plan.blocked).toEqual([]);
    expect(plan.routes).toHaveLength(15);
    for (const route of plan.routes) {
      expect(route).toMatchObject({
        platform: 'radford_acalog_course',
        boundary_contract: RADFORD_BOUNDARY_CONTRACT,
        required_crawl_delay_seconds: 120,
        target_count: 1,
      });
      expect(route.official_url).toBe(expectedRadfordCourseUrl(route.target_course_codes[0]));
    }
  });

  it('routes exact retained-entry recursive identities without changing either direct roster', () => {
    const cases = [{
      school_id: 9223,
      slug: 'radford-university',
      owner_namespace: 'va:uni:9223',
      catalog_year: '2026-2027',
      direct: RADFORD_DIRECT_COURSE_RECORDS,
      closure: RADFORD_CLOSURE_COURSE_RECORDS,
      official_url: 'https://catalog.radford.edu/content.php?catoid=62&navoid=3427',
      contract: RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
      expectedUrl: expectedRadfordCourseUrl,
    }, {
      school_id: 9226,
      slug: 'the-university-of-virginia-s-college-at-wise',
      owner_namespace: 'va:uni:9226',
      catalog_year: '2026-2027',
      direct: UVA_WISE_DIRECT_COURSE_RECORDS,
      closure: UVA_WISE_CLOSURE_COURSE_RECORDS,
      official_url: 'http://catalog.uvawise.edu/preview_program.php?catoid=9&poid=496',
      contract: UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
      expectedUrl: expectedUvaWiseCourseUrl,
    }];
    for (const row of cases) {
      const closureCodes = Object.keys(row.closure);
      const scope = { snapshot_date: '2026-08-23', universities: [{
        school_id: row.school_id,
        slug: row.slug,
        owner_namespace: row.owner_namespace,
        catalog_year: row.catalog_year,
        direct_named_course_codes: Object.keys(row.direct),
        cached_course_catalog: { official_url: row.official_url, byte_match: true },
      }] };
      const plan = buildAcquisitionPlan({
        scope,
        candidates: { candidates: [] },
        review: { closure: { unresolved_outside_direct_scope: closureCodes.map(
          (code) => `${row.owner_namespace}:${code}`,
        ) } },
      });
      expect(plan.blocked).toEqual([]);
      const recursive = plan.routes.filter((route) => route.discovery_course_code);
      expect(recursive).toHaveLength(closureCodes.length);
      for (const route of recursive) {
        const code = route.target_course_codes[0];
        expect(route).toMatchObject({
          discovery_contract: row.contract,
          discovery_cache_path: row.closure[code].discovery_cache_path,
          discovery_response_sha256: row.closure[code].discovery_response_sha256,
          discovery_course_code: row.closure[code].discovery_course_code,
          required_crawl_delay_seconds: 120,
        });
        expect(route.official_url).toBe(row.expectedUrl(code));
      }
    }
  });

  it('routes fourteen program and five exact-filter Shenandoah catoid-33 identities', () => {
    const closureOnly = ['INT101', 'MATH101', 'MATH102'];
    const supported = Object.keys(SHENANDOAH_DIRECT_COURSE_RECORDS)
      .filter((code) => !closureOnly.includes(code));
    const scope = { snapshot_date: '2026-08-23', universities: [{
      school_id: 9224,
      slug: 'shenandoah-university',
      owner_namespace: 'va:uni:9224',
      catalog_year: '2025-2026',
      direct_named_course_codes: supported,
      cached_course_catalog: {
        official_url: 'https://catalog.su.edu/content.php?catoid=33&navoid=1985',
        byte_match: true,
      },
    }] };
    const plan = buildAcquisitionPlan({
      scope,
      candidates: { candidates: [] },
      review: { closure: { unresolved_outside_direct_scope: closureOnly.map(
        (code) => `va:uni:9224:${code}`,
      ) } },
    });
    expect(plan.routes).toHaveLength(19);
    expect(plan.blocked).toEqual([]);
    for (const route of plan.routes) {
      expect(route).toMatchObject({
        platform: 'shenandoah_acalog_course',
        boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
        catoid: 33,
        required_crawl_delay_seconds: 120,
        target_count: 1,
      });
      expect(route.official_url)
        .toBe(expectedShenandoahCourseUrl(route.target_course_codes[0]));
    }
    const filtered = plan.routes.filter((route) => route.discovery_official_url);
    expect(filtered.map((route) => route.target_course_codes[0]))
      .toEqual(['ENG101', 'FYS101', 'INT101', 'MATH101', 'MATH102']);
    expect(filtered.every((route) => (
      route.discovery_contract.includes('exact_filtered_link')
      && route.discovery_cache_path.includes('_discovery.html')
      && /^[a-f0-9]{64}$/.test(route.discovery_response_sha256)
    ))).toBe(true);
    expect(plan.summary).toMatchObject({
      tested_shenandoah_acalog_course_routes: 19,
      route_target_keys: 19,
      owner_specific_blocked_keys: 0,
    });

    const drifted = structuredClone(scope);
    drifted.universities[0].catalog_year = '2026-2027';
    const driftedPlan = buildAcquisitionPlan({
      scope: drifted,
      candidates: { candidates: [] },
      review: { closure: { unresolved_outside_direct_scope: closureOnly.map(
        (code) => `va:uni:9224:${code}`,
      ) } },
    });
    expect(driftedPlan.routes).toEqual([]);
    expect(driftedPlan.blocked[0]).toMatchObject({
      target_count: 19,
      reason: expect.stringContaining('context drifted'),
    });
  });
});
