import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pmtPy } from './pmtPy';

const PYTHON = (() => {
  try { return execSync('which python3', { encoding: 'utf8' }).trim(); } catch { return null; }
})();

describe('pmt.py template', () => {
  const src = pmtPy('https://research.example.org');

  it('lets the runner override the baked API base via PMT_API_URL', () => {
    expect(src).toContain('API = os.environ.get("PMT_API_URL") or "https://research.example.org"');
  });

  it('publish() enters capture mode when the runner sets PMT_CAPTURE', () => {
    expect(src).toContain('PMT_CAPTURE');
    // one figure per live script — a second publish() must fail loudly
    expect(src).toMatch(/more than once/i);
    // the capture-path return mirrors the server response shape (dataset_version present)
    expect(src).toContain('"dataset_version": payload["dataset_version"]');
  });

  it('exposes one public publish() method for live figure files', () => {
    expect(src.match(/^def /gm)).toHaveLength(2);
    expect(src).toContain('def get(path, **params):');
    expect(src).toContain('def publish(file, slug, title');
    expect(src).toContain('pmt.publish("my_figure.py", slug="my-figure", title="My figure")');
    expect(src).toContain('fetch = get');
    expect(src).not.toContain('def publish_static(');
    expect(src).not.toContain('def publish_script(');
    expect(src).not.toContain('def fetch(');
    expect(src).not.toContain('def _');
  });

  it('posts live figure files to /figure-scripts', () => {
    expect(src).toContain('/figure-scripts');
  });

  it('renders with no unexpanded template placeholders', () => {
    expect(src).not.toContain('${');
  });

  it.skipIf(!PYTHON)('is valid python (py_compile passes on the rendered source)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmtpy-test-'));
    const file = path.join(dir, 'pmt.py');
    fs.writeFileSync(file, src);
    try {
      execSync(`${PYTHON} -m py_compile ${JSON.stringify(file)}`, { encoding: 'utf8' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
