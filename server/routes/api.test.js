const router = require('./api');

const paths = router.stack
  .filter((layer) => layer.route)
  .map((layer) => layer.route.path);

describe('canonical API router', () => {
  it('contains the stable source, curated, export, task, and publish paths', () => {
    expect(paths).toContain('/assist/institutions');
    expect(paths).toContain('/assist/courses');
    expect(paths).toContain('/assist/agreements');
    expect(paths).toContain('/curated/requirements');
    expect(paths).toContain('/curated/prerequisites');
    expect(paths).toContain('/exports/courses');
    expect(paths).toContain('/tasks');
    expect(paths).toContain('/publish');
    expect(paths).toContain('/gallery');
  });

  it('does not expose retired names beneath /api', () => {
    expect(paths.some((path) => String(path).startsWith('/analysis/'))).toBe(false);
    expect(paths.some((path) => String(path).startsWith('/figure-scripts'))).toBe(false);
    expect(paths.some((path) => String(path).startsWith('/references/'))).toBe(false);
    expect(paths.some((path) => String(path).startsWith('/curation/ref'))).toBe(false);
    expect(paths).not.toContain('/community-colleges');
    expect(paths).not.toContain('/schools');
    expect(paths).not.toContain('/figures');
  });
});
