import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { postAsDegreeAssist } = cjs('./Curation');

function run(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; resolve(this); return this; },
    };
    handler(req, res, reject);
  });
}

describe('AS-degree assist controller', () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
    vi.restoreAllMocks();
  });

  it('returns a friendly 503 when AI assist is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await run(postAsDegreeAssist, {
      body: { instruction: 'Correct the core.' },
      params: { id: 'as_degree:110:ast' },
      user: { uid: 'partner-1' },
      app: { locals: { db: {} } },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      error: 'ai_assist_unavailable',
      detail: 'ANTHROPIC_API_KEY is not configured on the server.',
    });
    expect(log).toHaveBeenCalledWith(
      '[ai-assist] uid=partner-1 doc=as_degree:110:ast instruction="Correct the core."',
    );
  });

  it('rejects an empty instruction before logging an attempt', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await run(postAsDegreeAssist, {
      body: { instruction: '   ' },
      params: { id: 'as_degree:110:ast' },
      user: { uid: 'partner-1' },
      app: { locals: { db: {} } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'instruction required' });
    expect(log).not.toHaveBeenCalled();
  });
});
