const {
  auditTidewaterFigure34OpenRuleEvidence,
  factsSha256,
  loadTidewaterFigure34OpenRuleEvidence,
} = require('./tidewaterFigure34OpenRuleEvidence');

describe('Tidewater Figure 3/4 open-rule evidence', () => {
  it('reproduces the exact fail-closed blocker inventory without editing the core', () => {
    const { degree, evidence } = loadTidewaterFigure34OpenRuleEvidence();
    expect(factsSha256(evidence)).toBe(evidence.facts_sha256);
    expect(auditTidewaterFigure34OpenRuleEvidence(degree, evidence)).toMatchObject({
      valid: true,
      issues: [],
      source_capture: {
        exact_current_official_bytes_retained: false,
        transparent_render_observations: 4,
      },
      active_constraints: [
        expect.objectContaining({ kind: 'direct_placement_with_category_replacement' }),
        expect.objectContaining({ kind: 'footnote_8_source_language_ambiguity' }),
        expect.objectContaining({ kind: 'world_language_category_open' }),
        expect.objectContaining({ kind: 'world_language_category_open' }),
      ],
      blocking_quality_flags: [
        'catalog_footnote_8_ambiguous',
        'direct_placement_receiver_not_supported',
      ],
      world_language: {
        modeled_count: 13,
        additional_asl_candidates: ['ASL101', 'ASL102', 'ASL201', 'ASL202'],
        exhaustive_roster_proved: false,
        safe_to_add_asl: false,
      },
      figure_3_ready: false,
      figure_4_ready: false,
      database_writes: 0,
      verified_major_core_edits: 0,
    });
  });

  it('does not silently promote ASL from adjacent-program evidence', () => {
    const { degree, evidence } = loadTidewaterFigure34OpenRuleEvidence();
    degree.option_sets.world_language.courses.push('ASL101');
    const result = auditTidewaterFigure34OpenRuleEvidence(degree, evidence);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('modeled_world_language_inventory_changed');
    expect(result.issues).toContain('asl_scope_boundary_changed');
  });

  it('fails closed if a source blocker is relabeled as implemented', () => {
    const { degree, evidence } = loadTidewaterFigure34OpenRuleEvidence();
    degree.requirement_groups[10].analysis_constraints[0].status = 'supported';
    const result = auditTidewaterFigure34OpenRuleEvidence(degree, evidence);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'active_constraint_changed:requirement_groups[10].analysis_constraints[0]',
    );
  });

  it('rejects a publishable verdict without the institutional answers', () => {
    const { degree, evidence } = loadTidewaterFigure34OpenRuleEvidence();
    evidence.verdict.figure_3_ready = true;
    evidence.verdict.safe_public_source_closures = 1;
    const result = auditTidewaterFigure34OpenRuleEvidence(degree, evidence);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      'fail_closed_verdict_changed',
      'facts_sha256_changed',
    ]));
  });

  it('binds the questions to the current catalog identity', () => {
    const { degree, evidence } = loadTidewaterFigure34OpenRuleEvidence();
    degree.catalog_version.program_id = 9999;
    const result = auditTidewaterFigure34OpenRuleEvidence(degree, evidence);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('catalog_identity_changed');
  });
});
