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
  const src = pmtPy('https://research.example.org/api');

  it('uses the canonical API base and allows a local override', () => {
    expect(src).toContain('API = (os.environ.get("PMT_API_URL") or "https://research.example.org/api").rstrip("/")');
    expect(src).toContain('f"{API}/{str(path).lstrip(\'/\')}"');
  });

  it('exposes only data reads and local figure publishing', () => {
    expect(src.match(/^def /gm)).toHaveLength(3);
    expect(src).toContain('def get(path, **params):');
    expect(src).toContain('def publish(fig=None, slug=None, title=None, caption=None, source_url=None,');
    expect(src).toContain('fetch = get');
    expect(src).not.toContain('PMT_CAPTURE');
    expect(src).not.toContain('figure-scripts');
    expect(src).not.toContain('subprocess');
  });

  it('renders SVG, PNG, and PDF on the caller machine before posting', () => {
    expect(src).toContain('for fmt in ("svg", "png", "pdf")');
    expect(src).toContain('fig.savefig(');
    expect(src).toContain('f"{API}/publish"');
    expect(src).toContain('payload["formats"] = _render_formats(fig)');
  });

  it('renders named states locally before uploading their control metadata', () => {
    expect(src).toContain('variants=None, controls=None, default_variant=None');
    expect(src).toContain('"formats": _render_formats(figure)');
    expect(src).toContain('"default_variant": default_variant or rendered[0]["key"]');
    expect(src).not.toContain('exec(');
  });

  it('includes a directly runnable matplotlib example', () => {
    expect(src).toContain('fig, ax = plt.subplots()');
    expect(src).toContain('publish(fig, slug="hello-figure", title="Hello figure")');
  });

  it('renders with no unexpanded template placeholders', () => {
    expect(src).not.toContain('${');
  });

  it.skipIf(!PYTHON)('is valid python', () => {
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
