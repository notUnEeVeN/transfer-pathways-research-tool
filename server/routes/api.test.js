const router = require('./api');

const paths = router.stack
  .filter((layer) => layer.route)
  .map((layer) => layer.route.path);

describe('research API router', () => {
  it('contains the stable data, analysis, export, task, and publish paths', () => {
    expect(paths).toContain('/assist/institutions');
    expect(paths).toContain('/assist/courses');
    expect(paths).toContain('/assist/agreements');
    expect(paths).toContain('/curated/requirements');
    expect(paths).toContain('/curated/prerequisites');
    expect(paths).toContain('/curated/as-degrees');
    expect(paths).toContain('/curated/as-degree-availability');
    expect(paths).toContain('/curated/as-degree-validation-cohort');
    expect(paths).toContain('/curated/as-degrees/:id/assist');
    expect(paths).toContain('/exports/courses');
    expect(paths).toContain('/exports/cs-ast-degrees');
    expect(paths).toContain('/exports/local-cs-as-degrees');
    expect(paths).toContain('/tasks');
    expect(paths).toContain('/publish');
    expect(paths).toContain('/gallery');
    expect(paths).toContain('/analysis/coverage');
    expect(paths).toContain('/analysis/releases');
    expect(paths).toContain('/analysis/requirement-comparison');
    expect(paths).toContain('/analysis/credit-loss');
    expect(paths).toContain('/analysis/multi-campus-pathways');
    expect(paths).toContain('/analysis/multi-campus-pathways/snapshot');
    expect(paths).toContain('/analysis/choice-cost');
    expect(paths).toContain('/analysis/category-gaps');
    expect(paths).toContain('/analysis/complexity');
    expect(paths).toContain('/analysis/time-to-degree');
    expect(paths).toContain('/admin/analysis-releases');
    expect(paths).toContain('/admin/analysis-disabled');
  });

  it('does not expose retired names beneath /api', () => {
    expect(paths.some((path) => String(path).startsWith('/figure-scripts'))).toBe(false);
    expect(paths.some((path) => String(path).startsWith('/references/'))).toBe(false);
    expect(paths.some((path) => String(path).startsWith('/curation/ref'))).toBe(false);
    expect(paths).not.toContain('/community-colleges');
    expect(paths).not.toContain('/schools');
    expect(paths).not.toContain('/figures');
  });
});
