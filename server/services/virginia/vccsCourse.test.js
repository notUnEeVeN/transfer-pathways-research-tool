const {
  parseRequisiteClause,
  parseVccsCoursePage,
} = require('./vccsCourse');

function page(code, title, endtext = '', extras = '') {
  return `<!doctype html><html><body>
    <dl><dt id="${code}"><a>${code.replace(/([A-Z]+)(\d+)/, '$1 $2')} - ${title}</a></dt>
    <dd><div class="coursedesc">Description for ${title}.</div>
    <div class="endtext">Lecture 3 hours. ${endtext}</div>
    <div class="credits">3 credits</div><!-- 2025-08-01 --></dd></dl>
    <div id="offeredByDiv">
      <a class="list-group-item scheduled" href="/colleges/nova/courses/${code}">Northern Virginia</a>
      <a class="list-group-item notScheduled" href="/colleges/brcc/courses/${code}">Blue Ridge</a>
    </div>${extras}</body></html>`;
}

describe('VCCS requisite grammar', () => {
  it('preserves MTH 167 OR the MTH 161+162 sequence', () => {
    const group = parseRequisiteClause(
      'prerequisite',
      'Completion of MTH 167 or MTH 161/162 or equivalent with a grade of C or better.'
    );
    expect(group.paths).toHaveLength(2);
    expect(group.paths.map((path) => path.all_of.filter((c) => c.type === 'course').map((c) => c.code)))
      .toEqual([['MTH167'], ['MTH161', 'MTH162']]);
    expect(group.paths.flatMap((path) => path.all_of).filter((c) => c.type === 'course'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'MTH167', minimum_grade: 'C', equivalent_allowed: true }),
        expect.objectContaining({ code: 'MTH161', minimum_grade: 'C', equivalent_allowed: true }),
        expect.objectContaining({ code: 'MTH162', minimum_grade: 'C', equivalent_allowed: true }),
      ]));
    expect(group.any_of).toBeUndefined();
  });

  it('keeps alternative-specific grades on MTH 266', () => {
    const group = parseRequisiteClause(
      'prerequisite',
      'Completion of MTH 263 or equivalent with a grade of B or better or MTH 264 or equivalent with a grade of C or better.'
    );
    expect(group.paths).toHaveLength(2);
    expect(group.paths[0].all_of[0]).toMatchObject({ code: 'MTH263', minimum_grade: 'B' });
    expect(group.paths[1].all_of[0]).toMatchObject({ code: 'MTH264', minimum_grade: 'C' });
  });

  it('represents compound course paths and permission losslessly', () => {
    const group = parseRequisiteClause(
      'prerequisite',
      'CSC 201 and 202, or EGR 125 or permission of instructor.'
    );
    expect(group.paths).toHaveLength(3);
    expect(group.paths[0].all_of.map((c) => c.code)).toEqual(['CSC201', 'CSC202']);
    expect(group.paths[1].all_of[0]).toMatchObject({ type: 'course', code: 'EGR125' });
    expect(group.paths[2].all_of[0]).toMatchObject({ type: 'non_course', condition: 'consent' });
  });

  it('distributes a shared conjunction across either/or branches', () => {
    const egr = parseRequisiteClause(
      'prerequisite',
      'EGR 121 and either EGR 125 or CSC 221'
    );
    expect(egr.paths.map((path) => path.all_of.filter((c) => c.type === 'course').map((c) => c.code)))
      .toEqual([['EGR121', 'EGR125'], ['EGR121', 'CSC221']]);

    const phy = parseRequisiteClause(
      'prerequisite',
      'PHY 201 with a grade of C or better and MTH 162 or MTH 167 with a grade of C or better.'
    );
    expect(phy.paths.map((path) => path.all_of.filter((c) => c.type === 'course').map((c) => c.code)))
      .toEqual([['PHY201', 'MTH162'], ['PHY201', 'MTH167']]);
  });

  it('distributes a parenthetical alternative across the remaining AND list', () => {
    const group = parseRequisiteClause(
      'prerequisite',
      'BIO 142 (or BIO 232), NSG 100, NSG 106, NSG 130 and NSG 200'
    );
    expect(group.paths.map((path) => path.all_of.filter((c) => c.type === 'course').map((c) => c.code)))
      .toEqual([
        ['BIO142', 'NSG100', 'NSG106', 'NSG130', 'NSG200'],
        ['BIO232', 'NSG100', 'NSG106', 'NSG130', 'NSG200'],
      ]);
  });

  it('protects grade "or higher" and expands carried prefixes before OR splitting', () => {
    const chemistry = parseRequisiteClause('prerequisite', 'CHM 111 with a grade of C or higher');
    expect(chemistry.paths).toHaveLength(1);
    expect(chemistry.paths[0].all_of[0]).toMatchObject({ code: 'CHM111', minimum_grade: 'C' });

    const english = parseRequisiteClause('prerequisite', 'ENG 111 OR 112 or divisional approval.');
    expect(english.paths[0].all_of[0]).toMatchObject({ code: 'ENG111' });
    expect(english.paths[1].all_of[0]).toMatchObject({ code: 'ENG112' });
    expect(english.paths[2].all_of[0]).toMatchObject({ type: 'non_course', condition: 'consent' });

    const psychology = parseRequisiteClause('prerequisite', 'PSY 200, 201 or divisional approval.');
    expect(psychology.paths.slice(0, 2).map((path) => path.all_of[0].code))
      .toEqual(['PSY200', 'PSY201']);
    const biology = parseRequisiteClause('prerequisite', 'BIO 101, BIO 102, and CHM 111.');
    expect(biology.paths).toHaveLength(1);
    expect(biology.paths[0].all_of.map((condition) => condition.code))
      .toEqual(['BIO101', 'BIO102', 'CHM111']);
  });

  it('marks semicolon grammar unsafe while retaining the raw clause', () => {
    const group = parseRequisiteClause(
      'prerequisite',
      'Eligible for ENG 111; MTH 162 or MTH 167 with a grade of C or better; or divisional approval.'
    );
    expect(group.raw).toContain('Eligible for ENG 111;');
    expect(group.flags).toContain('unsupported_semicolon_grammar');
  });

  it('treats ampersand as AND and course eligibility as readiness', () => {
    const biology = parseRequisiteClause('prerequisite', 'BIO 101 & BIO 102 or equivalent.');
    expect(biology.paths).toHaveLength(1);
    expect(biology.paths[0].all_of.map((condition) => condition.code)).toEqual(['BIO101', 'BIO102']);
    expect(biology.paths[0].residual_text).toBeUndefined();

    const chemistry = parseRequisiteClause('prerequisite', 'ENG 111 Eligible');
    expect(chemistry.paths[0].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'course_eligibility', code: 'ENG111',
    });
  });

  it('preserves free-form non-course alternatives without calling them residue', () => {
    const language = parseRequisiteClause(
      'prerequisite',
      'ARA 101, or two years of successful completion of high school Arabic, or demonstrated experiential learning, or by placement test, or equivalent.'
    );
    expect(language.paths.some((path) => path.all_of.some((condition) => (
      condition.type === 'non_course' && condition.raw.includes('high school Arabic')
    )))).toBe(true);
    expect(language.flags).not.toContain('unparsed_residue');
  });

  it('does not convert inline titles or repeated grade clauses into conditions', () => {
    const mth = parseRequisiteClause(
      'prerequisite',
      'Placement or completion of MTH 161: Precalculus I or equivalent with a grade of C or better.'
    );
    expect(mth.paths[1].all_of).toEqual([
      expect.objectContaining({ type: 'course', code: 'MTH161', minimum_grade: 'C' }),
    ]);
    expect(mth.paths[1].residual_text).toBeUndefined();
    expect(mth.raw).toContain('Precalculus I');

    const phy = parseRequisiteClause(
      'prerequisite',
      'PHY 241 with a grade of C or better and MTH 264 with a grade of C or better.'
    );
    expect(phy.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'PHY241', minimum_grade: 'C' }),
      expect.objectContaining({ code: 'MTH264', minimum_grade: 'C' }),
    ]);
    expect(phy.paths[0].all_of.some((condition) => condition.type === 'non_course')).toBe(false);
  });

  it('parses inline linked-course titles while preserving them in raw text', () => {
    const parsed = parseVccsCoursePage(page(
      'MTH162',
      'Precalculus II',
      'Prerequisite: Placement or completion of MTH 161: Precalculus I or equivalent with a grade of C or better.'
    ), { requestedCode: 'MTH162' });
    expect(parsed.status).toBe('parsed');
    expect(parsed.raw_requisites).toContain('Precalculus I');
    expect(parsed.flags).not.toContain('unparsed_residue');
  });
});

describe('VCCS master course page parser', () => {
  it('extracts prerequisites, corequisites, effective date, and supply', () => {
    const parsed = parseVccsCoursePage(page(
      'CSC223',
      'Data Structures',
      'Prerequisite: CSC 222 or departmental consent. Corequisite: CSC 208 or equivalent.'
    ), { requestedCode: 'CSC223', url: 'https://courses.vccs.edu/courses/CSC223' });
    expect(parsed).toMatchObject({
      found: true,
      code: 'CSC223',
      status: 'parsed',
      effective: '2025-08-01',
      credits: 3,
    });
    expect(parsed.groups.map((group) => group.kind)).toEqual(['prerequisite', 'corequisite']);
    expect(parsed.supply).toEqual([
      {
        slug: 'brcc', name: 'Blue Ridge', scheduled: false,
        url: 'https://courses.vccs.edu/colleges/brcc/courses/CSC223',
      },
      {
        slug: 'nova', name: 'Northern Virginia', scheduled: true,
        url: 'https://courses.vccs.edu/colleges/nova/courses/CSC223',
      },
    ]);
  });

  it('distinguishes no requisites from a missing master course', () => {
    expect(parseVccsCoursePage(page('CSC221', 'Programming'), { requestedCode: 'CSC221' }).status)
      .toBe('none');
    expect(parseVccsCoursePage('<h2>CSC i221</h2>', { requestedCode: 'CSCI221' }))
      .toMatchObject({ found: false, status: 'missing', flags: ['no_exact_master_course'] });
  });
});
