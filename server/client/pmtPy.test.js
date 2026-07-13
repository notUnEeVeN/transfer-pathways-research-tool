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

  it('exposes only data reads and declarative figure publishing', () => {
    expect(src.match(/^def /gm)).toHaveLength(3);
    expect(src).toContain('def get(path, **params):');
    expect(src).toContain('def publish(fig=None, slug=None, title=None, caption=None, source_url=None,');
    expect(src).toContain('visual=None, options=None');
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

  it('publishes allowlisted interactive visuals as semantic manifests', () => {
    expect(src).toContain('if visual is not None:');
    expect(src).toContain('payload["visual"] = str(visual)');
    expect(src).toContain('interactive visuals own their controls');
    expect(src).toContain('publish(visual="paper-credit-loss"');
  });

  it('uses a read-only get call as its directly runnable connection check', () => {
    const main = src.split('if __name__ == "__main__":')[1];
    expect(main).toContain('get("assist/institutions", kind="university")');
    expect(main).toContain('institution_id');
    expect(main).not.toContain('publish(');
    expect(main).not.toContain('matplotlib');
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
