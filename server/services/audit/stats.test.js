import { describe, it, expect } from 'vitest';
import { wilsonUpper, wilsonUpperPct, wilsonUpperFinite, templateMatchConfidence, computeAuditStats } from './stats.js';

describe('wilsonUpperPct', () => {
  it('returns null for an empty sample', () => {
    expect(wilsonUpperPct(0, 0)).toBeNull();
  });

  it('gives the classic ~3.7% upper bound for 0 errors in 100', () => {
    expect(wilsonUpperPct(0, 100)).toBe(3.7);
  });

  it('caps at 100% when every trial is an error', () => {
    expect(wilsonUpperPct(1, 1)).toBe(100);
    expect(wilsonUpperPct(10, 10)).toBe(100);
  });

  it('stays above the point estimate (it is an upper bound)', () => {
    const upper = wilsonUpperPct(5, 100) // phat = 5%
    expect(upper).toBeGreaterThan(5)
    expect(upper).toBeLessThan(15)
  });

  it('tightens as the sample grows for the same error rate', () => {
    // 5% observed at n=100 vs n=1000 — the larger sample has a tighter bound.
    expect(wilsonUpperPct(50, 1000)).toBeLessThan(wilsonUpperPct(5, 100));
  });

  it('honors the decimals argument', () => {
    expect(wilsonUpperPct(0, 100, 4)).toBe(3.6995);
  });

  it('is deterministic', () => {
    expect(wilsonUpperPct(3, 250)).toBe(wilsonUpperPct(3, 250));
  });
});

describe('templateMatchConfidence', () => {
  it('is 1.0 today (byte-exact template hash → no matching uncertainty)', () => {
    expect(templateMatchConfidence()).toBe(1.0);
    expect(templateMatchConfidence({ system: 'uc' })).toBe(1.0);
  });
});

describe('wilsonUpper (unrounded fraction)', () => {
  it('returns null for an empty sample', () => {
    expect(wilsonUpper(0, 0)).toBeNull();
  });
  it('is the unrounded fraction behind wilsonUpperPct', () => {
    const f = wilsonUpper(0, 100);
    expect(f).toBeCloseTo(0.037, 3);
    expect(+(f * 100).toFixed(2)).toBe(wilsonUpperPct(0, 100));
  });
});

describe('wilsonUpperFinite (finite-population correction)', () => {
  it('returns null for an empty sample', () => {
    expect(wilsonUpperFinite(0, 0, 100)).toBeNull();
  });
  it('equals plain Wilson when N is null', () => {
    expect(wilsonUpperFinite(0, 100)).toBeCloseTo(wilsonUpper(0, 100), 10);
  });
  it('tightens as the sample covers the population', () => {
    expect(wilsonUpperFinite(0, 90, 100)).toBeLessThan(wilsonUpper(0, 90));
  });
  it('returns the observed rate at full census (n >= N)', () => {
    expect(wilsonUpperFinite(3, 10, 10)).toBeCloseTo(0.3, 10);
    expect(wilsonUpperFinite(0, 10, 10)).toBe(0);
  });
});

describe('computeAuditStats — provenance & scope-restricted template bound', () => {
  const systemByKey = new Map([['uc', { idField: 'uc_school_id' }]]);
  const mk = (over) => ({
    result: 'correct', source: 'verify', system: 'uc', uc_school_id: 1,
    receivers_checked: 2, cells_in_error: 0, ...over,
  });
  const verdicts = [
    // two GLOBAL random draws, distinct templates: one correct, one error
    mk({ major: 'Bio',  raw_template_hash: 'h1', sample_method: 'random',   sample_scope: 'all',  result: 'correct' }),
    mk({ major: 'Phys', raw_template_hash: 'h2', sample_method: 'random',   sample_scope: 'all',  result: 'error' }),
    // a TARGETED pick — excluded from the random bound, counted everywhere else
    mk({ major: 'Chem', raw_template_hash: 'h3', sample_method: 'targeted', sample_scope: 'all',  result: 'error' }),
    // a random draw under a GROUPING — must NOT feed the global bound
    mk({ major: 'Econ', raw_template_hash: 'h4', sample_method: 'random',   sample_scope: 'g:G1', result: 'error' }),
  ];
  const base = { totalDocs: 1000, nTemplates: 100, nMajors: 100, nCellsTotal: 5000, nStale: 0, clusterAggregates: [], systemByKey };
  const all = computeAuditStats({ ...base, verdicts, sampleScope: 'all' });

  it('counts every verdict in coverage/error totals regardless of source/scope', () => {
    expect(all.n_audited).toBe(4);
    expect(all.n_errors).toBe(3); // h2, h3, h4
  });

  it('restricts the headline bound to random draws over the requested scope', () => {
    expect(all.n_random_clusters).toBe(2);       // only h1 + h2 (random, scope all)
    expect(all.n_random_clusters_error).toBe(1); // h2
    expect(all.ci_upper_safety_pct).toBe(+(wilsonUpperFinite(1, 2, 100) * 100).toFixed(2));
  });

  it('computes a separate bound for a grouping scope', () => {
    const g = computeAuditStats({ ...base, verdicts, sampleScope: 'g:G1' });
    expect(g.n_random_clusters).toBe(1);         // only h4
    expect(g.n_random_clusters_error).toBe(1);
  });

  it('keeps the all-templates cluster bound over ALL audits (incl. targeted)', () => {
    expect(all.n_audited_clusters).toBe(4);
    expect(all.cluster_student_risk_upper_pct).toBe(wilsonUpperPct(3, 4));
  });

  it('still drops the tightening factor and inflated doc-level propagated bound', () => {
    expect(all.tightening_factor).toBeUndefined();
    expect(all.template_propagated_student_risk_upper_pct).toBeUndefined();
  });
});
